/**
 * Aprovar o plano da semana (espec. 3.7.5; planejamento S3 §4.4; D142, D216, D219):
 * - nova versão da regra do convite em cada faixa que mudou (oferta, teto ou texto), ligada ao plano;
 * - reativação simulada pelo CRM: a mesma função pura do simulador (cota de 50% do teto livre, decidida antes do
 *   sorteio do grupo); real para convidáveis, fantasma para o holdout; pula quem já tem convite ativo;
 * - idempotente (lock do restaurante + plano já aprovado → devolve o envio existente; índice único em `plan_sends`).
 */
import { queueInviteMessages } from "@/src/modules/salao/application/queue-messages";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/src/db/client";
import type { Executor, Tx } from "@/src/db/executor";
import { ownerEdits, planSendMembers, planSends, restaurantCustomers, restaurants, weeklyPlans } from "@/src/db/schema";
import { checkOffer, describeOffer, OFFER_KINDS, type Offer, offerFromInput, type OfferKind } from "@/src/modules/beneficios/domain/offers";
import { guardText } from "@/src/modules/ia/guardrails";
import { slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import { loadContext, remainingBySlot, inviteSlots } from "@/src/modules/salao/application/context";
import { insertInvite, reserveQuota } from "@/src/modules/salao/application/persistence";
import { newOfferVersion } from "@/src/modules/config/application/update-settings";
import { loadCustomerRows, toReactivationCustomers } from "@/src/modules/analytics/application/customers";
import { weekKeySP } from "@/src/shared/week";
import { reactivationPlan, REACTIVATION_SHARE_PCT } from "../domain/reactivation";
import { effectiveReview, type StoredReview } from "@/src/modules/ia/tasks/reviewer";

const offerInput = z.object({ kind: z.enum(OFFER_KINDS), itemId: z.string().max(64), pct: z.number().int().min(1).max(100).optional() });
export const finalPlanSchema = z.object({
  slots: z.array(z.object({ slotId: z.string().uuid(), offer: offerInput, weeklyCap: z.number().int().min(1).max(999), inviteText: z.string().max(300) })).min(1).max(8),
});
export type FinalPlan = z.infer<typeof finalPlanSchema>;

export type ApproveResult =
  | { ok: true; already: boolean; sent: { real: number; fantasma: number; emails?: number }; inviteIds?: string[] }
  | { ok: false; erro: "nao_encontrado" | "nao_proposto" | "inativo" | "faixas" | "oferta" | "texto" | "revisor"; detalhe?: unknown };

const toOffer = (o: { kind: OfferKind; itemId: string; pct?: number }): Offer => offerFromInput(o);
const same = (a: Offer, b: Offer) => a.kind === b.kind && a.params.itemId === b.params.itemId && (a.params.pct ?? null) === (b.params.pct ?? null);

async function sentFor(db: Executor, planId: string): Promise<{ real: number; fantasma: number }> {
  const [s] = await db.select({ id: planSends.id }).from(planSends).where(eq(planSends.planId, planId)).limit(1);
  if (!s) return { real: 0, fantasma: 0 };
  const rows = (await db.execute(sql`select arm, count(*)::int n from plan_send_members where send_id = ${s.id} group by arm`)) as unknown as { rows: Array<{ arm: string; n: number }> };
  return { real: rows.rows.find((r) => r.arm === "convidavel")?.n ?? 0, fantasma: rows.rows.find((r) => r.arm === "holdout")?.n ?? 0 };
}

export type ApproveVia = "portal" | "agente" | "email" | "copiloto";

/** Plano "como está" (MCP e link do e-mail): as escolhas guardadas, com o teto sugerido. */
export function finalFromStored(plan: { candidates: unknown; choices: unknown; decision: unknown }): FinalPlan {
  const cands = (plan.candidates ?? []) as Array<{ slotId: string; options: Array<{ id: string; offer: FinalPlan["slots"][number]["offer"]; weeklyCap: number }> }>;
  const choices = (plan.choices ?? []) as Array<{ slotId: string; candidateId: string; textoConvite: string }>;
  const caps = (plan.decision as { caps?: Record<string, number> } | null)?.caps ?? {};
  const slots = choices.flatMap((c) => {
    const o = cands.find((x) => x.slotId === c.slotId)?.options.find((x) => x.id === c.candidateId);
    return o ? [{ slotId: c.slotId, offer: o.offer, weeklyCap: caps[c.slotId] ?? o.weeklyCap, inviteText: c.textoConvite }] : [];
  });
  return { slots };
}
type ApproveInput = { restaurantId: string; planId: string; final: FinalPlan; via: ApproveVia; now: Date };

export async function approvePlan(db: Db, p: ApproveInput): Promise<ApproveResult> {
  return db.transaction((tx) => approvePlanInTx(tx, p));
}

/** O mesmo caso de uso dentro de uma transação aberta (S6, D187: o token do e-mail é queimado na mesma transação). */
export async function approvePlanInTx(tx: Tx, p: ApproveInput): Promise<ApproveResult> {
  {
    const [r] = await tx.select().from(restaurants).where(eq(restaurants.id, p.restaurantId)).for("update");
    if (!r) return { ok: false as const, erro: "nao_encontrado" as const };
    if (r.status !== "ativo" && !r.copiedFrom) return { ok: false as const, erro: "inativo" as const };
    const [plan] = await tx.select().from(weeklyPlans).where(and(eq(weeklyPlans.id, p.planId), eq(weeklyPlans.restaurantId, p.restaurantId))).for("update");
    if (!plan) return { ok: false as const, erro: "nao_encontrado" as const };
    if (plan.status === "aprovado") return { ok: true as const, already: true, sent: await sentFor(tx, plan.id) };
    if (plan.status !== "proposto") return { ok: false as const, erro: "nao_proposto" as const };

    // Convites vencidos que ainda constam como ativos (o check-in só os vence ao voltar): vencem aqui, para a
    // reativação alcançar o mesmo público que a prévia mostrou (revisão técnica S3).
    await tx.execute(sql`update invites set status = 'expirado' where restaurant_id = ${p.restaurantId} and status in ('ativo', 'suprimido') and expires_at <= ${p.now}`);
    const ctx = (await loadContext(tx, p.restaurantId))!;
    const activeMenu = ctx.menu.filter((m) => !ctx.inactiveItemIds.includes(m.id));
    const slotIds = new Set(ctx.slots.map((s) => s.id));
    if (!p.final.slots.every((s) => slotIds.has(s.slotId)) || new Set(p.final.slots.map((s) => s.slotId)).size !== p.final.slots.length) return { ok: false as const, erro: "faixas" as const };
    const items = Object.fromEntries(ctx.menu.map((m) => [m.id, m.name]));

    const proposed = plan.choices as Array<{ slotId: string; candidateId: string; textoConvite: string; justificativa: string }>;
    // Revisor (flag; espec. 4.4): "revisando" (até 20 s) segura a aprovação; "bloquear" segura enquanto houver
    // convite da IA — se o dono reescreveu todos, ele assume os textos (guard em modo dono) [C] D148.
    const review = (plan.decision as { reviewer?: StoredReview } | null)?.reviewer;
    const ownerRewrote = p.final.slots.every((s) => s.inviteText.trim() !== (proposed.find((x) => x.slotId === s.slotId)?.textoConvite ?? "").trim());
    const eff = effectiveReview(review, p.now);
    if (eff?.status === "revisando" || (eff?.status === "bloquear" && !ownerRewrote)) return { ok: false as const, erro: "revisor" as const, detalhe: { reasons: eff.reasons } };
    const candidates = plan.candidates as Array<{ slotId: string; options: Array<{ id: string; offer: { kind: string; itemId: string; pct?: number }; weeklyCap: number }> }>;
    const edits: Array<{ kind: string; ref: string | null; suggested: unknown; final: unknown }> = [];
    const finalChoices: typeof proposed = [];
    for (const s of p.final.slots) {
      const offer = toOffer(s.offer);
      // S6.3a (D197) + S8: regra única (`checkOffer`) — item "fora das ofertas" não entra por nenhum caminho.
      const errs = checkOffer(offer, activeMenu, ctx.noOfferItemIds);
      if (errs.length) return { ok: false as const, erro: "oferta" as const, detalhe: { slotId: s.slotId, erros: errs } };
      const slot = ctx.slots.find((x) => x.id === s.slotId)!;
      const g = guardText(s.inviteText, { items, slots: { [slot.id]: slotPhrase(slot) }, oferta: describeOffer(offer, ctx.menu, "convite").gain }, { allowed: ["prato", "horario", "oferta"], maxLen: 160, field: "textoConvite", mode: "dono" });
      if (!g.ok) return { ok: false as const, erro: "texto" as const, detalhe: { slotId: s.slotId, motivos: g.reasons } };
      const cur = ctx.convites[s.slotId];
      const text = s.inviteText.trim();
      if (!cur || !same(cur.offer, offer) || cur.weeklyCap !== s.weeklyCap || (cur.inviteText ?? "") !== text) {
        await newOfferVersion(tx, { restaurantId: p.restaurantId, role: "convite", slotId: s.slotId, offer, weeklyCap: s.weeklyCap, inviteText: text, planId: plan.id, now: p.now });
      }
      const opts = candidates.find((c) => c.slotId === s.slotId)?.options ?? [];
      const match = opts.find((o) => o.offer.kind === offer.kind && o.offer.itemId === offer.params.itemId && (o.offer.pct ?? null) === (offer.params.pct ?? null));
      const prev = proposed.find((x) => x.slotId === s.slotId);
      const candidateId = match?.id ?? `manual:${offer.kind}:${offer.params.itemId}`;
      finalChoices.push({ slotId: s.slotId, candidateId, textoConvite: text, justificativa: prev?.justificativa ?? "" });
      if (prev?.candidateId !== candidateId) edits.push({ kind: "plano:convite_oferta", ref: s.slotId, suggested: prev?.candidateId ?? null, final: candidateId });
      if ((prev?.textoConvite ?? "") !== text) edits.push({ kind: "plano:convite_texto", ref: s.slotId, suggested: prev?.textoConvite ?? null, final: text });
      const suggestedCap = (plan.decision as { caps?: Record<string, number> } | null)?.caps?.[s.slotId] ?? match?.weeklyCap ?? null;
      if (suggestedCap !== null && suggestedCap !== s.weeklyCap) edits.push({ kind: "plano:teto", ref: s.slotId, suggested: suggestedCap, final: s.weeklyCap });
    }

    await tx
      .update(weeklyPlans)
      // Vale para a semana ISO (SP) da aprovação (espec. 3.7): uma proposta de domingo aprovada na segunda é desta semana.
      .set({ status: "aprovado", weekKey: weekKeySP(p.now), approvedAt: p.now, approvedVia: p.via, choices: finalChoices, decision: { ...((plan.decision as object | null) ?? {}), approvedChoices: finalChoices.map((c) => ({ slotId: c.slotId, candidateId: c.candidateId })) } })
      .where(eq(weeklyPlans.id, plan.id));
    await tx.insert(ownerEdits).values((edits.length ? edits : [{ kind: "plano:sem_edicao", ref: null, suggested: null, final: null }]).map((e) => ({ restaurantId: p.restaurantId, ...e, at: p.now })));

    // Reativação (espec. 3.7.5; S4.4 — D155): mesma regra do simulador; o convite real chega no app do cliente
    // (Jornada) e por e-mail a quem aceitou — o e-mail sai depois do commit, pela rota.
    const ctx2 = (await loadContext(tx, p.restaurantId))!;
    const weekKey = weekKeySP(p.now);
    const remaining = await remainingBySlot(tx, ctx2, weekKey);
    const rows = await loadCustomerRows(tx, p.restaurantId, p.now);
    const decisions = reactivationPlan(toReactivationCustomers(rows), inviteSlots(ctx2), remaining, { sharePct: REACTIVATION_SHARE_PCT, restaurantId: p.restaurantId }, p.now);
    const [send] = await tx.insert(planSends).values({ restaurantId: p.restaurantId, planId: plan.id, channel: "app_email", sentAt: p.now, recipients: 0 }).onConflictDoNothing().returning({ id: planSends.id });
    if (!send) return { ok: true as const, already: true, sent: await sentFor(tx, plan.id) };
    let real = 0;
    let fantasma = 0;
    const realInviteIds: string[] = [];
    for (const { customerId, decision: d } of decisions) {
      if (d.kind === "real") {
        const cap = ctx2.convites[d.slotId]?.weeklyCap ?? 0;
        if (!(await reserveQuota(tx, { restaurantId: p.restaurantId, slotId: d.slotId, weekKey, cap }))) continue;
      }
      // Um check-in simultâneo pode ter emitido convite: o índice de 1 ativo barra e o cliente é pulado (revisão T-I7).
      await tx.execute(sql`savepoint reat`);
      let ok: string | null = null;
      try {
        ok = await insertInvite(tx, { restaurantId: p.restaurantId, customerId, slot: d.slot, arm: d.arm, benefitVersionId: ctx2.convites[d.slotId]?.versionId ?? null, origin: "reativacao", at: p.now, expiresAt: d.expiresAt, planSendId: send.id });
        await tx.execute(sql`release savepoint reat`);
      } catch {
        await tx.execute(sql`rollback to savepoint reat`);
      }
      if (!ok) continue;
      if (d.armIsNew) await tx.update(restaurantCustomers).set({ arm: d.arm, armAssignedAt: p.now }).where(and(eq(restaurantCustomers.restaurantId, p.restaurantId), eq(restaurantCustomers.customerId, customerId), isNull(restaurantCustomers.arm)));
      await tx.insert(planSendMembers).values({ sendId: send.id, customerId, inviteId: ok, arm: d.arm });
      if (d.arm === "holdout") fantasma++;
      else {
        real++;
        realInviteIds.push(ok);
      }
    }
    await tx.update(planSends).set({ recipients: real }).where(eq(planSends.id, send.id));
    const emails = await queueInviteMessages(tx, { inviteIds: realInviteIds, kind: "reativacao", now: p.now });
    return { ok: true as const, already: false, sent: { real, fantasma, emails }, inviteIds: realInviteIds };
  }
}

export type DiscardReason = "ofertas" | "teto" | "manter" | "outro";
export async function discardPlan(db: Db, p: { restaurantId: string; planId: string; reason: DiscardReason; text?: string; now: Date }): Promise<{ ok: true } | { ok: false; erro: "nao_encontrado" | "nao_proposto" }> {
  return db.transaction(async (tx) => {
    const [plan] = await tx.select().from(weeklyPlans).where(and(eq(weeklyPlans.id, p.planId), eq(weeklyPlans.restaurantId, p.restaurantId))).for("update");
    if (!plan) return { ok: false as const, erro: "nao_encontrado" as const };
    if (plan.status !== "proposto") return { ok: false as const, erro: "nao_proposto" as const };
    const text = p.text?.trim().slice(0, 200) || null;
    await tx.update(weeklyPlans).set({ status: "descartado", decision: { ...((plan.decision as object | null) ?? {}), discard: { reason: p.reason, text } } }).where(eq(weeklyPlans.id, plan.id));
    await tx.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "plano:descartado", ref: plan.id, suggested: null, final: { reason: p.reason, text }, at: p.now });
    return { ok: true as const };
  });
}

/** Plano mais recente que a tela mostra: o proposto/gerando, senão o último aprovado. */
export async function latestPlan(db: Db, restaurantId: string) {
  const [p] = await db.select().from(weeklyPlans).where(and(eq(weeklyPlans.restaurantId, restaurantId), sql`${weeklyPlans.status} <> 'descartado'`)).orderBy(desc(weeklyPlans.createdAt)).limit(1);
  return p ?? null;
}
