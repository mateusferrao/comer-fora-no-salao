/**
 * Resumo semanal do dono (S6.1 — D163, D187, D188, D193, D196):
 * - monta o e-mail (semana fechada + topo em R$ + plano proposto) e o token de "Revisar e aprovar";
 * - página de confirmação: GET sem efeito; POST aprova na mesma transação em que o token é queimado (`via: email`);
 * - prévia no Portal (com o link funcionando) e "Enviar agora" (3/dia) — nenhum dos dois grava `weekly_digests`;
 * - envio do agendador: reserva `weekly_digests` (reservado → enviado | falhou), idempotente por semana.
 * O e-mail do dono só é decifrado na hora do envio e nunca vai ao log (D118).
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Executor } from "@/src/db/executor";
import { digestTokens, owners, restaurants, weeklyDigests, weeklyPlans } from "@/src/db/schema";
import type { MailSender } from "@/src/modules/contas/adapters/mail-sender";
import { parseNotifySettings, type NotifySettings } from "@/src/modules/config/domain/notify-settings";
import { getValueTopline } from "@/src/modules/analytics/application/dashboard";
import { effectiveReview, type StoredReview } from "@/src/modules/ia/tasks/reviewer";
import { decryptEmail, signValue, verifySigned } from "@/src/shared/crypto";
import { log } from "@/src/shared/log";
import { consume } from "@/src/shared/rate-limit";
import { safeErr } from "@/src/shared/safe-err";
import { hashToken, newToken, plausibleToken, sameHash } from "@/src/shared/tokens";
import { daySP, instantSP } from "@/src/shared/tz";
import { addDaysSP } from "@/src/shared/week";
import { digestEmail, type DigestView } from "../domain/digest-email";
import { approvePlanInTx, finalFromStored, type ApproveResult } from "./approve-plan";
import { getPlanView, type PlanView } from "./plan-view";

export const DIGEST_TOKEN_PREFIX = "rv_";
export const DIGEST_TOKEN_TTL_MS = 7 * 86_400_000;
export const SEND_NOW_PER_DAY = 3;
export const RESERVATION_STALE_MS = 10 * 60_000;

export const portalPlanPath = "/parceiro/salao/plano";
export const approvePath = (token: string) => `/parceiro/aprovar/${token}`;
export const stopToken = (restaurantId: string) => signValue(`resumo-off:${restaurantId}`);
export const stopPath = (restaurantId: string) => `/parceiro/resumo/parar?t=${encodeURIComponent(stopToken(restaurantId))}`;

export function restaurantFromStopToken(t: string | null | undefined): string | null {
  const v = verifySigned(t);
  const m = v ? /^resumo-off:([0-9a-f-]{36})$/.exec(v) : null;
  return m ? m[1]! : null;
}

type Owner = { id: string; via: string; emailEnc: string | null; emailHint: string | null };

async function loadRestaurant(ex: Executor, restaurantId: string) {
  const [r] = await ex
    .select({ id: restaurants.id, name: restaurants.name, status: restaurants.status, settings: restaurants.notifySettings, ownerId: restaurants.ownerId })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId));
  if (!r) return null;
  const [o] = await ex.select({ id: owners.id, via: owners.via, emailEnc: owners.emailEnc, emailHint: owners.emailHint }).from(owners).where(eq(owners.id, r.ownerId));
  return { ...r, settings: parseNotifySettings(r.settings), owner: (o ?? null) as Owner | null };
}

/** Semana ISO fechada anterior a `now` (segunda a domingo, dias de SP). */
export function previousWeek(now: Date): { from: string; to: string } {
  const today = daySP(now);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = addDaysSP(today, -((dow + 6) % 7));
  return { from: addDaysSP(monday, -7), to: addDaysSP(monday, -1) };
}

async function weekStats(ex: Executor, restaurantId: string, w: { from: string; to: string }) {
  const start = instantSP(w.from, 0).toISOString();
  const end = instantSP(addDaysSP(w.to, 1), 0).toISOString();
  const r = (await ex.execute(sql`
    select
      (select count(*)::int from checkins where restaurant_id = ${restaurantId} and day_sp between ${w.from} and ${w.to}) as checkins,
      (select count(*)::int from codes where restaurant_id = ${restaurantId} and status = 'validado' and validated_at >= ${start} and validated_at < ${end}) as validados,
      (select count(*)::int from codes where restaurant_id = ${restaurantId} and type = 'convite' and status = 'validado' and validated_at >= ${start} and validated_at < ${end}) as convites`)) as unknown as {
    rows: Array<{ checkins: number; validados: number; convites: number }>;
  };
  const x = r.rows[0];
  return { checkins: Number(x?.checkins ?? 0), validados: Number(x?.validados ?? 0), convitesUsados: Number(x?.convites ?? 0) };
}

function planSlots(v: PlanView | null) {
  if (!v?.plan || v.plan.status !== "proposto" || v.generating || v.plan.stale) return null;
  const slots = v.slots.flatMap((s) => {
    const o = s.options.find((x) => x.id === s.chosenId);
    return o ? [{ phrase: s.phrase, gain: o.gain, cap: s.weeklyCap, maxCostCents: o.unitCostCents * s.weeklyCap, justificativa: s.justificativa }] : [];
  });
  return slots.length ? { planId: v.plan.id, slots } : null;
}

export async function createDigestToken(ex: Executor, p: { restaurantId: string; planId: string; now: Date }): Promise<string> {
  const token = newToken(DIGEST_TOKEN_PREFIX);
  await ex.insert(digestTokens).values({ tokenHash: hashToken(token), restaurantId: p.restaurantId, planId: p.planId, expiresAt: new Date(p.now.getTime() + DIGEST_TOKEN_TTL_MS), createdAt: p.now });
  return token;
}

/**
 * Monta o e-mail desta semana. `withToken`: cria o token de "Revisar e aprovar" (envio real e prévia) quando há
 * plano proposto e o dono permite aprovar pelo e-mail.
 */
export async function buildDigest(db: Db, p: { restaurantId: string; now: Date; baseUrl: string; withToken: boolean }) {
  const r = await loadRestaurant(db, p.restaurantId);
  if (!r) return null;
  const week = previousWeek(p.now);
  const [stats, topline, view] = await Promise.all([weekStats(db, p.restaurantId, week), getValueTopline(db, p.restaurantId, p.now), getPlanView(db, p.restaurantId, p.now)]);
  const plan = planSlots(view);
  const token = plan && r.settings.aprovarEmail && p.withToken ? await createDigestToken(db, { restaurantId: p.restaurantId, planId: plan.planId, now: p.now }) : null;
  const digest: DigestView = {
    restaurant: r.name,
    week,
    stats,
    topline,
    plan: plan ? { slots: plan.slots } : null,
    links: { aprovar: token ? `${p.baseUrl}${approvePath(token)}` : null, portal: `${p.baseUrl}${portalPlanPath}`, parar: `${p.baseUrl}${stopPath(p.restaurantId)}` },
  };
  return { restaurant: r, planId: plan?.planId ?? null, token, mail: digestEmail(digest) };
}

const sendable = (email: string | null): email is string => !!email && !email.endsWith(".invalid") && !email.endsWith("@simulator.amazonses.com");

/** Prévia do Portal: o texto exato e o link funcionando (token próprio); nada é gravado em `weekly_digests`. */
export async function previewDigest(db: Db, p: { restaurantId: string; now: Date; baseUrl: string }) {
  const lim = await consume(db, `resumo:previa:${p.restaurantId}`, 20, 3_600, p.now);
  if (!lim.ok) return { ok: false as const, erro: "limite" as const, retryAfterSec: lim.retryAfterSec };
  const d = await buildDigest(db, { ...p, withToken: true });
  if (!d) return { ok: false as const, erro: "nao_encontrado" as const };
  const settings = d.restaurant.settings;
  return {
    ok: true as const,
    subject: d.mail.subject,
    text: d.mail.text,
    approveUrl: d.token ? `${p.baseUrl}${approvePath(d.token)}` : null,
    hasPlan: !!d.planId,
    aprovarEmail: settings.aprovarEmail,
    to: d.restaurant.owner?.emailEnc ? d.restaurant.owner.emailHint : null,
    ownerVia: d.restaurant.owner?.via ?? null,
  };
}

/** "Enviar agora" (até 3/dia): para o e-mail guardado do dono. */
export async function sendDigestNow(db: Db, p: { restaurantId: string; now: Date; baseUrl: string; sender: MailSender | null }) {
  const r = await loadRestaurant(db, p.restaurantId);
  const email = decryptEmail(r?.owner?.emailEnc);
  if (!r || !sendable(email) || !p.sender) return { ok: false as const, erro: "sem_email" as const };
  const lim = await consume(db, `resumo:enviar:${p.restaurantId}:${daySP(p.now)}`, SEND_NOW_PER_DAY, 86_400, p.now);
  if (!lim.ok) return { ok: false as const, erro: "limite" as const, retryAfterSec: lim.retryAfterSec };
  const d = (await buildDigest(db, { ...p, withToken: true }))!;
  try {
    await p.sender.send({ to: email, ...d.mail });
    return { ok: true as const, to: r.owner!.emailHint };
  } catch (err) {
    log.error("falha no envio do resumo", { area: "resumo_email", err: safeErr(err) });
    return { ok: false as const, erro: "falhou" as const };
  }
}

/**
 * Envio do agendador para a semana `weekKey`: reserva única por (restaurante, semana); reserva velha (> 10 min) é
 * retomada. Devolve o que aconteceu (para o tique contar).
 */
export async function sendWeeklyDigest(db: Db, p: { restaurantId: string; weekKey: string; now: Date; baseUrl: string; sender: MailSender | null }): Promise<"enviado" | "falhou" | "ja" | "pulado"> {
  const r = await loadRestaurant(db, p.restaurantId);
  const email = decryptEmail(r?.owner?.emailEnc);
  if (!r || !sendable(email) || !p.sender || r.owner?.via === "e2e") return "pulado";
  const stale = new Date(p.now.getTime() - RESERVATION_STALE_MS).toISOString();
  const reserved = (await db.execute(sql`
    insert into weekly_digests (restaurant_id, week_key, status, reserved_at, via)
    values (${p.restaurantId}, ${p.weekKey}, 'reservado', ${p.now.toISOString()}, 'agendador')
    on conflict (restaurant_id, week_key) do update set reserved_at = excluded.reserved_at
      where weekly_digests.status = 'reservado' and weekly_digests.reserved_at < ${stale}
    returning id`)) as unknown as { rows: Array<{ id: string }> };
  const id = reserved.rows[0]?.id;
  if (!id) return "ja";
  const d = (await buildDigest(db, { restaurantId: p.restaurantId, now: p.now, baseUrl: p.baseUrl, withToken: true }))!;
  try {
    await p.sender.send({ to: email, ...d.mail });
    await db.update(weeklyDigests).set({ status: "enviado", sentAt: p.now, planId: d.planId }).where(eq(weeklyDigests.id, id));
    return "enviado";
  } catch (err) {
    log.error("falha no envio do resumo", { area: "resumo_email", err: safeErr(err) });
    await db.update(weeklyDigests).set({ status: "falhou", planId: d.planId }).where(eq(weeklyDigests.id, id));
    return "falhou";
  }
}

// ---------- Página "Revisar e aprovar" ----------

export type DigestPageState = "ok" | "usado" | "substituido" | "nao_proposto" | "revisor" | "desligado";
export type DigestPage = {
  state: DigestPageState;
  restaurant: string;
  planStatus: string;
  reviewReasons: string[];
  slots: Array<{ phrase: string; gain: string; cap: number; maxCostCents: number; justificativa: string; invite: string }>;
  reactivation: { audience: number; real: number };
};

async function findToken(ex: Executor, token: string, now: Date, lock = false) {
  if (!plausibleToken(token, DIGEST_TOKEN_PREFIX)) return null;
  const h = hashToken(token);
  const q = ex.select().from(digestTokens).where(eq(digestTokens.tokenHash, h)).limit(1);
  const [row] = lock ? await q.for("update") : await q;
  if (!row || !sameHash(row.tokenHash, h) || row.expiresAt.getTime() <= now.getTime()) return null;
  return row;
}

/** GET: só leitura. `null` = token inválido ou expirado (a página responde 404). */
export async function digestPage(db: Db, token: string, now: Date): Promise<DigestPage | null> {
  const t = await findToken(db, token, now);
  if (!t) return null;
  const r = await loadRestaurant(db, t.restaurantId);
  if (!r) return null;
  const [plan] = await db.select().from(weeklyPlans).where(and(eq(weeklyPlans.id, t.planId), eq(weeklyPlans.restaurantId, t.restaurantId)));
  if (!plan) return null;
  const view = await getPlanView(db, t.restaurantId, now, plan.id);
  const slots = (view?.slots ?? []).flatMap((s) => {
    const o = s.options.find((x) => x.id === s.chosenId);
    return o ? [{ phrase: s.phrase, gain: o.gain, cap: s.weeklyCap, maxCostCents: o.unitCostCents * s.weeklyCap, justificativa: s.justificativa, invite: s.inviteRendered }] : [];
  });
  const review = effectiveReview((plan.decision as { reviewer?: StoredReview } | null)?.reviewer, now);
  const state: DigestPageState = t.usedAt
    ? "usado"
    : plan.status === "vencido"
      ? "substituido"
      : plan.status !== "proposto"
        ? "nao_proposto"
        : !r.settings.aprovarEmail
          ? "desligado"
          : review?.status === "revisando" || review?.status === "bloquear"
            ? "revisor"
            : "ok";
  return {
    state,
    restaurant: r.name,
    planStatus: plan.status,
    reviewReasons: review?.status === "bloquear" || review?.status === "revisando" ? (review.reasons ?? []) : [],
    slots,
    reactivation: { audience: view?.reactivation.audience ?? 0, real: view?.reactivation.real ?? 0 },
  };
}

export type ApproveByDigestResult =
  | { ok: true; restaurantId: string; already: boolean; sent: { real: number; fantasma: number; emails?: number }; inviteIds: string[] }
  | { ok: false; erro: "invalido" | "usado" | "substituido" | "nao_proposto" | "revisor" | "desligado" | "oferta" | "texto" | "faixas" | "inativo" | "nao_encontrado" };

/** POST: aprova o plano "como está" e queima o token na MESMA transação; com erro, o token continua valendo. */
export async function approveByDigest(db: Db, p: { token: string; now: Date }): Promise<ApproveByDigestResult> {
  return db.transaction(async (tx) => {
    const t = await findToken(tx, p.token, p.now, true);
    if (!t) return { ok: false as const, erro: "invalido" as const };
    if (t.usedAt) return { ok: false as const, erro: "usado" as const };
    const [r] = await tx.select({ settings: restaurants.notifySettings }).from(restaurants).where(eq(restaurants.id, t.restaurantId));
    if (!parseNotifySettings(r?.settings).aprovarEmail) return { ok: false as const, erro: "desligado" as const };
    const [plan] = await tx.select().from(weeklyPlans).where(and(eq(weeklyPlans.id, t.planId), eq(weeklyPlans.restaurantId, t.restaurantId)));
    if (!plan) return { ok: false as const, erro: "invalido" as const };
    if (plan.status === "vencido") return { ok: false as const, erro: "substituido" as const };
    if (plan.status !== "proposto") return { ok: false as const, erro: "nao_proposto" as const };
    const res: ApproveResult = await approvePlanInTx(tx, { restaurantId: t.restaurantId, planId: plan.id, final: finalFromStored(plan), via: "email", now: p.now });
    if (!res.ok) return { ok: false as const, erro: res.erro };
    await tx.update(digestTokens).set({ usedAt: p.now }).where(and(eq(digestTokens.tokenHash, t.tokenHash), isNull(digestTokens.usedAt)));
    return { ok: true as const, restaurantId: t.restaurantId, already: res.already, sent: res.sent, inviteIds: res.inviteIds ?? [] };
  });
}

/** "Não quero mais receber este resumo" (link assinado, POST). */
export async function stopDigest(db: Db, p: { token: string; now: Date }): Promise<{ ok: boolean; restaurant?: string }> {
  const rid = restaurantFromStopToken(p.token);
  if (!rid) return { ok: false };
  return db.transaction(async (tx) => {
    const [r] = await tx.select({ name: restaurants.name, settings: restaurants.notifySettings }).from(restaurants).where(eq(restaurants.id, rid)).for("update");
    if (!r) return { ok: false };
    const s: NotifySettings = parseNotifySettings(r.settings);
    await tx.update(restaurants).set({ notifySettings: { ...s, resumo: { ...s.resumo, on: false } } }).where(eq(restaurants.id, rid));
    return { ok: true, restaurant: r.name };
  });
}

/** Último resumo enviado (cartão do Portal). */
export async function lastDigest(ex: Executor, restaurantId: string) {
  const [d] = await ex.select().from(weeklyDigests).where(eq(weeklyDigests.restaurantId, restaurantId)).orderBy(desc(weeklyDigests.reservedAt)).limit(1);
  return d ? { weekKey: d.weekKey, status: d.status, sentAt: d.sentAt?.toISOString() ?? null } : null;
}
