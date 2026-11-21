/**
 * Casos de uso do kit (espec. 3.4): gerar (IA ou modelo sem IA), editar campo, regenerar campo, aprovar
 * peça e marcar "no salão". Display e cartaz compartilham os textos de cada versão (um modelo em 2 tamanhos).
 */
import { ownerDataOf } from "@/src/modules/config/domain/ai-profile";
import { parseAiFeatures } from "@/src/modules/config/domain/ai-profile";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Executor } from "@/src/db/executor";
import { kitPieces, ownerEdits, owners, pieceVariants, restaurants, scans } from "@/src/db/schema";
import { describeOffer } from "@/src/modules/beneficios/domain/offers";
import { consume } from "@/src/shared/rate-limit";
import { secureRandInt } from "@/src/shared/crypto";
import { systemClock } from "@/src/shared/clock";
import { safeErr } from "@/src/shared/safe-err";
import { recordAiCall } from "@/src/modules/ia/ai-calls";
import { getActivePrompt, getFlags, promptSuffix } from "@/src/modules/config/application/app-config";
import { ownerExamples } from "@/src/modules/ia/examples";
import { runReview } from "@/src/modules/ia/application/review";
import { effectiveReview, reviewBlocks, type StoredReview } from "@/src/modules/ia/tasks/reviewer";
import { gatewayFor, keyKindFor } from "@/src/modules/ia/gateway-factory";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { guardText } from "@/src/modules/ia/guardrails";
import { MODELS } from "@/src/modules/ia/models";
import { runTask } from "@/src/modules/ia/run-task";
import { langfuseTracer } from "@/src/modules/ia/tracing";
import { buildKitPrompt, buildKitTask, KIT_PROMPT_VERSION, resolveKit } from "@/src/modules/ia/tasks/kit";
import { renderReferences, type RefContext } from "@/src/modules/textos/domain/references";
import { loadContext, type RestaurantContext } from "@/src/modules/salao/application/context";
import { FALLBACK_KIT, FIELD_MAX, WAITER_TEMPLATE, waiterPhrase, type KitTexts, type VersionField } from "../domain/templates";
import { log } from "@/src/shared/log";
import { abTable } from "@/src/modules/analytics/domain/operations";
import { getVariantStats } from "@/src/modules/analytics/application/operations";

export const KIT_STALE_MS = 90_000;
const ALPHA = "abcdefghijkmnpqrstuvwxyz23456789";
const token = () => Array.from({ length: 12 }, () => ALPHA[secureRandInt(ALPHA.length)]).join("");

export type VariantTexts = { titulo?: string; subtitulo?: string; acao?: string; frase?: string; origem?: "ia" | "sem_ia" | "dono"; gerando?: boolean; sugerido?: Partial<Record<VersionField, string>> };

function kitCtx(ctx: RestaurantContext): { refCtx: RefContext; inviteItemIds: string[]; beneficio: string; recompensa: string } {
  const beneficio = ctx.agora ? describeOffer(ctx.agora.offer, ctx.menu, "agora").gain : "um benefício";
  const recompensa = ctx.recompensa ? describeOffer(ctx.recompensa.offer, ctx.menu, "recompensa").gain : "uma recompensa";
  return {
    beneficio,
    recompensa,
    inviteItemIds: Object.values(ctx.convites).map((c) => c.offer.params.itemId),
    refCtx: { beneficio, recompensa, items: Object.fromEntries(ctx.menu.map((m) => [m.id, m.name])) },
  };
}

async function aiTexts(db: Db, ctx: RestaurantContext, ownerId: string, gateway?: AiGateway | null): Promise<{ texts: KitTexts; origem: "ia" | "sem_ia" }> {
  const k = kitCtx(ctx);
  const [owner] = await db.select({ emailHmac: owners.emailHmac, via: owners.via }).from(owners).where(eq(owners.id, ownerId));
  const keyKind = keyKindFor({ emailHmac: owner?.emailHmac ?? null, via: owner?.via ?? null });
  const choice = gateway !== undefined ? { gateway, keyKind } : await gatewayFor(db, keyKind, new Date());
  if (!choice.gateway) return { texts: FALLBACK_KIT, origem: "sem_ia" };
  const menu = ctx.menu.filter((m) => !ctx.inactiveItemIds.includes(m.id));
  const prompt = await getActivePrompt(db, "kit");
  // Aprende (D35, flag): campos do kit que o próprio dono escreveu e que passam no guard em modo `ia`.
  const examples = (await getFlags(db)).aprende && parseAiFeatures(ctx.restaurant.aiFeatures).aprende
    ? await ownerExamples(db, ctx.restaurant.id, ["kit:campo"], (raw) => guardText(raw, k.refCtx, { allowed: ["beneficio", "recompensa", "prato"], maxLen: 200, field: "kit", mode: "ia", forbidDayTurn: true, forbidItemIds: k.inviteItemIds, avoid: ownerDataOf(ctx.restaurant).avoid }).ok && !/convite|volt(e|ar)/i.test(raw))
    : [];
  const kp = buildKitPrompt({ restaurantName: ctx.restaurant.name, cuisine: ctx.restaurant.cuisine, beneficio: k.beneficio, recompensa: k.recompensa, menu, inviteItemIds: k.inviteItemIds, instructions: prompt.instructions, tone: ctx.restaurant.aiTone, examples, owner: ownerDataOf(ctx.restaurant) });
  const r = await runTask(buildKitTask(kp, MODELS.kit), kp.system, { text: kp.text }, { gateway: choice.gateway, clock: systemClock, trace: langfuseTracer });
  await recordAiCall(db, { task: "kit", promptVersion: `${KIT_PROMPT_VERSION}${promptSuffix(prompt, { tone: !!ctx.restaurant.aiTone, examples: examples.length > 0, about: !!ctx.restaurant.aiAbout, avoid: !!ctx.restaurant.aiAvoid })}`, restaurantId: ctx.restaurant.id, result: r, keyKind: choice.keyKind });
  return r.status === "ok" ? { texts: resolveKit(kp, r.data), origem: "ia" } : { texts: FALLBACK_KIT, origem: "sem_ia" };
}

/** Cria as 3 peças (display e cartaz com A/B, cartão do garçom) sob lock — clique duplo = 1 kit. */
/** `schedule`: como rodar o revisor depois da resposta (rotas passam `after`); sem ele, roda em seguida. */
type Schedule = (fn: () => Promise<void>) => void;
const inline: Schedule = (fn) => void fn();

export async function generateKit(db: Db, p: { restaurantId: string; ownerId: string; now: Date; gateway?: AiGateway | null; reviewerGateway?: AiGateway | null; schedule?: Schedule }): Promise<{ ok: true; created: boolean } | { ok: false; erro: "limite" | "inativo" }> {
  const ctx = await loadContext(db, p.restaurantId);
  if (!ctx || ctx.restaurant.status !== "ativo") return { ok: false, erro: "inativo" };
  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"kit:" + p.restaurantId}))`);
    const existing = await tx.select({ id: kitPieces.id }).from(kitPieces).where(eq(kitPieces.restaurantId, p.restaurantId)).limit(1);
    if (existing.length) return false;
    const [owner] = await tx.select({ via: owners.via }).from(owners).where(eq(owners.id, p.ownerId));
    if (owner?.via !== "e2e") {
      const lim = await consume(tx, `kit:${p.restaurantId}`, 6, 86_400, p.now);
      if (!lim.ok) throw new KitLimitError();
    }
    for (const kind of ["display", "cartaz", "garcom"] as const) {
      const [piece] = await tx.insert(kitPieces).values({ restaurantId: p.restaurantId, kind, status: "rascunho", createdAt: p.now }).returning({ id: kitPieces.id });
      const labels = kind === "garcom" ? ["A"] : ["A", "B"];
      for (const label of labels) {
        await tx.insert(pieceVariants).values({ pieceId: piece!.id, restaurantId: p.restaurantId, label, qrToken: token(), texts: kind === "garcom" ? { frase: WAITER_TEMPLATE } : { gerando: true }, createdAt: p.now });
      }
    }
    return true;
  }).catch((e) => {
    if (e instanceof KitLimitError) return null;
    throw e;
  });
  if (created === null) return { ok: false, erro: "limite" };
  if (!created) return { ok: true, created: false };
  try {
    const { texts, origem } = await aiTexts(db, ctx, p.ownerId, p.gateway);
    await writeVersionTexts(db, p.restaurantId, texts, origem);
    if (!ctx.restaurant.recado) await db.update(restaurants).set({ recado: renderReferences(texts.recado, kitCtx(ctx).refCtx) }).where(eq(restaurants.id, p.restaurantId));
    if (origem === "ia") await maybeReview(db, p.restaurantId, p.now, p.schedule ?? inline, p.reviewerGateway);
  } catch (err) {
    log.error("falha na geração", { area: "kit", err: safeErr(err) });
    await writeVersionTexts(db, p.restaurantId, FALLBACK_KIT, "sem_ia");
  }
  return { ok: true, created: true };
}

class KitLimitError extends Error {}

// ---------- Revisor (flag) ----------

async function setKitReview(db: Db, restaurantId: string, r: StoredReview | null, onlyIfReviewing = false) {
  const ids = (await activeOfLabel(db, restaurantId, "A")).concat(await activeOfLabel(db, restaurantId, "B")).map((x) => x.id);
  // O veredito só vale para o texto revisado: se o dono editou durante a revisão (status zerado), não sobrescreve.
  if (ids.length)
    await db
      .update(pieceVariants)
      .set({ reviewerStatus: r?.status ?? null, reviewerReasons: r ? { reasons: r.reasons, at: r.at } : null })
      .where(and(inArray(pieceVariants.id, ids), onlyIfReviewing ? eq(pieceVariants.reviewerStatus, "revisando") : undefined));
}

/** Marca "revisando" já (bloqueia aprovar/imprimir) e agenda o revisor. */
async function maybeReview(db: Db, restaurantId: string, now: Date, schedule: Schedule, gateway?: AiGateway | null) {
  if (!(await getFlags(db)).revisor) return;
  // Contas de teste automatizado (via=e2e) ficam fora do revisor (custo e espera não determinística) [C] D148.
  const [o] = await db.select({ via: owners.via }).from(restaurants).innerJoin(owners, eq(owners.id, restaurants.ownerId)).where(eq(restaurants.id, restaurantId));
  if (o?.via === "e2e") return;
  await setKitReview(db, restaurantId, { status: "revisando", reasons: [], at: now.toISOString() });
  schedule(() => reviewKit(db, { restaurantId, now, gateway }).then(
    () => undefined,
    (err) => log.error("revisor falhou", { area: "kit", err: safeErr(err) }),
  ));
}

export async function reviewKit(db: Db, p: { restaurantId: string; now: Date; gateway?: AiGateway | null }): Promise<StoredReview> {
  const kit = await getKit(db, p.restaurantId, p.now);
  const ctx = await loadContext(db, p.restaurantId);
  const texts = (kit?.pieces.find((x) => x.kind === "display")?.variants ?? []).flatMap((v) => (["titulo", "subtitulo", "acao"] as const).map((f) => ({ label: `Versão ${v.label} · ${f}`, text: v.rendered[f] ?? "" })));
  if (kit?.recado) texts.push({ label: "Recado", text: kit.recado });
  const k = ctx ? kitCtx(ctx) : null;
  const r = await runReview(db, { restaurantId: p.restaurantId, offer: k ? `no 1º check-in: ${k.beneficio}; no 6º selo: ${k.recompensa}` : "", texts, now: p.now, gateway: p.gateway });
  await setKitReview(db, p.restaurantId, r, true);
  return r;
}

async function writeVersionTexts(db: Db, restaurantId: string, texts: KitTexts, origem: "ia" | "sem_ia") {
  const rows = await db
    .select({ id: pieceVariants.id, label: pieceVariants.label, kind: kitPieces.kind })
    .from(pieceVariants)
    .innerJoin(kitPieces, eq(kitPieces.id, pieceVariants.pieceId))
    .where(eq(pieceVariants.restaurantId, restaurantId));
  for (const r of rows) {
    if (r.kind === "garcom") continue;
    const v = texts[r.label === "B" ? "B" : "A"];
    await db.update(pieceVariants).set({ texts: { ...v, origem, sugerido: v } }).where(eq(pieceVariants.id, r.id));
  }
}

/** Ligado depois da ativação (em segundo plano). */
export async function startKitGeneration(db: Db, restaurantId: string, ownerId: string): Promise<void> {
  try {
    await generateKit(db, { restaurantId, ownerId, now: new Date() });
  } catch (err) {
    log.error("falha", { area: "kit", err: safeErr(err) });
  }
}

// ---------- Vista ----------

export type KitVariantView = { id: string; label: string; token: string; texts: VariantTexts; rendered: Record<string, string>; approvedAt: Date | null; scans: number; locked: boolean; review: StoredReview | null };
export type KitPieceView = { id: string; kind: "display" | "cartaz" | "garcom"; status: string; inSalonAt: Date | null; variants: KitVariantView[] };
export type KitView = { pieces: KitPieceView[]; generating: boolean; origem: "ia" | "sem_ia" | "dono" | null; recado: string | null; slug: string };

export async function getKit(db: Db, restaurantId: string, now: Date): Promise<KitView | null> {
  const ctx = await loadContext(db, restaurantId);
  if (!ctx) return null;
  const k = kitCtx(ctx);
  const waiterLink = (await getFlags(db)).modo_garcom;
  const pieces = await db.select().from(kitPieces).where(eq(kitPieces.restaurantId, restaurantId)).orderBy(asc(kitPieces.createdAt));
  const variants = pieces.length ? await db.select().from(pieceVariants).where(and(inArray(pieceVariants.pieceId, pieces.map((x) => x.id)), isNull(pieceVariants.retiredAt))).orderBy(asc(pieceVariants.label)) : [];
  const counts = await scanCounts(db, variants.map((v) => v.id));
  let generating = false;
  let origem: KitView["origem"] = null;
  const out: KitPieceView[] = [];
  for (const piece of pieces) {
    const vs: KitVariantView[] = [];
    for (const v of variants.filter((x) => x.pieceId === piece.id)) {
      let texts = v.texts as VariantTexts;
      if (texts.gerando) {
        if (now.getTime() - v.createdAt.getTime() > KIT_STALE_MS) {
          // Geração interrompida (restart): cai no modelo sem IA.
          const fb = FALLBACK_KIT[v.label === "B" ? "B" : "A"];
          texts = { ...fb, origem: "sem_ia", sugerido: fb };
          await db.update(pieceVariants).set({ texts }).where(eq(pieceVariants.id, v.id));
        } else generating = true;
      }
      if (texts.origem && piece.kind !== "garcom") origem = origem === "dono" ? "dono" : texts.origem;
      const fb = FALLBACK_KIT[v.label === "B" ? "B" : "A"];
      const raw = piece.kind === "garcom" ? { frase: texts.frase ?? WAITER_TEMPLATE } : { titulo: texts.titulo ?? fb.titulo, subtitulo: texts.subtitulo ?? fb.subtitulo, acao: texts.acao ?? fb.acao };
      const rendered = Object.fromEntries(Object.entries(raw).map(([key, t]) => [key, renderReferences(key === "frase" ? waiterPhrase(t, waiterLink) : t, k.refCtx)]));
      const n = counts.get(v.id) ?? 0;
      const stored = v.reviewerStatus ? ({ status: v.reviewerStatus, ...((v.reviewerReasons as { reasons: string[]; at: string } | null) ?? { reasons: [], at: v.createdAt.toISOString() }) } as StoredReview) : null;
      vs.push({ id: v.id, label: v.label, token: v.qrToken, texts: { ...texts, ...raw }, rendered, approvedAt: v.approvedAt, scans: n, locked: piece.kind !== "garcom" && n > 0, review: effectiveReview(stored, now) });
    }
    out.push({ id: piece.id, kind: piece.kind as KitPieceView["kind"], status: piece.status, inSalonAt: piece.inSalonAt, variants: vs });
  }
  return { pieces: out, generating, origem, recado: ctx.restaurant.recado, slug: ctx.restaurant.slug };
}

// ---------- Edição ----------

/**
 * Texto do dono nas peças e no recado (que todo cliente vê, inclusive o grupo de controle): dia, turno ou item
 * de convite viram AVISO, não bloqueio (D125) — contaminam a comparação (revisão da S2).
 */
function holdoutWarnings(value: string, k: ReturnType<typeof kitCtx>): string[] {
  const g = guardText(value, k.refCtx, { allowed: ["beneficio", "recompensa", "prato"], maxLen: 10_000, field: "kit", mode: "ia", forbidDayTurn: true, forbidItemIds: k.inviteItemIds });
  return g.ok ? [] : g.reasons.filter((r) => r.startsWith("dia_turno") || r.startsWith("item_do_convite")).map(() => "convite");
}

export type EditResult = { ok: true; warnings: string[] } | { ok: false; erro: "texto"; motivos: string[] } | { ok: false; erro: "nao_encontrado" | "limite" | "travado"; retryAfterSec?: number };

/** Leituras do QR por versão (reais e simuladas). */
async function scanCounts(db: Executor, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: scans.variantId, n: sql<number>`count(*)::int` }).from(scans).where(inArray(scans.variantId, ids)).groupBy(scans.variantId);
  return new Map(rows.map((r) => [r.id!, r.n]));
}

/** Versões vigentes (display e cartaz) de um rótulo A/B. */
async function activeOfLabel(db: Executor, restaurantId: string, label: "A" | "B") {
  return db
    .select({ id: pieceVariants.id, pieceId: pieceVariants.pieceId, texts: pieceVariants.texts, approvedAt: pieceVariants.approvedAt })
    .from(pieceVariants)
    .innerJoin(kitPieces, eq(kitPieces.id, pieceVariants.pieceId))
    .where(and(eq(pieceVariants.restaurantId, restaurantId), eq(pieceVariants.label, label), isNull(pieceVariants.retiredAt), inArray(kitPieces.kind, ["display", "cartaz"])));
}

/**
 * Versão com leituras fica com o texto travado (S2 #28, [C] D145): mudar o texto mistura o que foi medido.
 * Sem leituras, edita no lugar.
 */
async function isLocked(db: Executor, ids: string[]): Promise<boolean> {
  return [...(await scanCounts(db, ids)).values()].some((n) => n > 0);
}

/**
 * "Criar nova versão": aposenta a versão vigente (o QR dela continua funcionando; o A/B a ignora) e cria outra
 * com o mesmo texto e um QR novo, para editar e reimprimir.
 */
export async function newKitVersion(db: Db, p: { restaurantId: string; label: "A" | "B"; now: Date; textsFrom?: VariantTexts }): Promise<{ ok: true; ids: string[] } | { ok: false; erro: "nao_encontrado" | "sem_leituras" }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from restaurants where id = ${p.restaurantId} for update`);
    const rows = await activeOfLabel(tx, p.restaurantId, p.label);
    if (!rows.length) return { ok: false as const, erro: "nao_encontrado" as const };
    if (!(await isLocked(tx, rows.map((r) => r.id)))) return { ok: false as const, erro: "sem_leituras" as const };
    const ids: string[] = [];
    for (const r of rows) {
      await tx.update(pieceVariants).set({ retiredAt: p.now }).where(eq(pieceVariants.id, r.id));
      const texts = p.textsFrom ? { ...(r.texts as VariantTexts), titulo: p.textsFrom.titulo, subtitulo: p.textsFrom.subtitulo, acao: p.textsFrom.acao, origem: p.textsFrom.origem } : r.texts;
      const [n] = await tx.insert(pieceVariants).values({ pieceId: r.pieceId, restaurantId: p.restaurantId, label: p.label, qrToken: token(), texts, approvedAt: r.approvedAt ? p.now : null, createdAt: p.now }).returning({ id: pieceVariants.id });
      ids.push(n!.id);
    }
    await tx.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: p.textsFrom ? "kit:promover" : "kit:versao", ref: p.label, suggested: null, final: ids.join(","), at: p.now });
    return { ok: true as const, ids };
  });
}

/** Edita um campo de uma versão (A/B) — vale para display e cartaz (o mesmo modelo). Texto do dono: só aviso (D125). */
export async function editVersionField(db: Db, p: { restaurantId: string; label: "A" | "B"; field: VersionField; value: string; now: Date }): Promise<EditResult> {
  const ctx = await loadContext(db, p.restaurantId);
  if (!ctx) return { ok: false, erro: "nao_encontrado" };
  const k = kitCtx(ctx);
  const g = guardText(p.value, k.refCtx, { allowed: ["beneficio", "recompensa", "prato"], maxLen: FIELD_MAX[p.field], field: "kit", mode: "dono" });
  if (!g.ok) return { ok: false, erro: "texto", motivos: g.reasons };
  g.warnings.push(...holdoutWarnings(p.value, k));
  const rows = await activeOfLabel(db, p.restaurantId, p.label);
  if (!rows.length) return { ok: false, erro: "nao_encontrado" };
  if (await isLocked(db, rows.map((r) => r.id))) return { ok: false, erro: "travado" };
  for (const r of rows) {
    const t = r.texts as VariantTexts;
    // Texto do dono: a revisão anterior (do texto da IA) deixa de valer; o dono assume o texto (guard em modo dono).
    await db.update(pieceVariants).set({ texts: { ...t, [p.field]: p.value.trim(), origem: "dono" }, reviewerStatus: null, reviewerReasons: null }).where(eq(pieceVariants.id, r.id));
  }
  const before = (rows[0]!.texts as VariantTexts).sugerido?.[p.field] ?? null;
  await db.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "kit:campo", ref: `${p.label}.${p.field}`, suggested: before, final: p.value.trim(), at: p.now });
  return { ok: true, warnings: g.warnings };
}

/** "Regenerar campo": refaz a versão com a IA e troca só aquele campo (30/dia por restaurante). */
export async function regenerateField(db: Db, p: { restaurantId: string; ownerId: string; label: "A" | "B"; field: VersionField; now: Date; gateway?: AiGateway | null; reviewerGateway?: AiGateway | null; schedule?: Schedule }): Promise<EditResult> {
  const [owner] = await db.select({ via: owners.via }).from(owners).where(eq(owners.id, p.ownerId));
  if (owner?.via !== "e2e") {
    const lim = await consume(db, `kit:campo:${p.restaurantId}`, 30, 86_400, p.now);
    if (!lim.ok) return { ok: false, erro: "limite", retryAfterSec: lim.retryAfterSec };
  }
  const ctx = await loadContext(db, p.restaurantId);
  if (!ctx) return { ok: false, erro: "nao_encontrado" };
  const rows = await activeOfLabel(db, p.restaurantId, p.label);
  if (!rows.length) return { ok: false, erro: "nao_encontrado" };
  if (await isLocked(db, rows.map((r) => r.id))) return { ok: false, erro: "travado" };
  const { texts, origem } = await aiTexts(db, ctx, p.ownerId, p.gateway);
  const value = texts[p.label][p.field];
  // A IA leva segundos: se um QR desta versão foi lido nesse meio-tempo, a versão travou (revisão técnica S3).
  if (await isLocked(db, rows.map((r) => r.id))) return { ok: false, erro: "travado" };
  for (const r of rows) {
    const t = r.texts as VariantTexts;
    await db.update(pieceVariants).set({ texts: { ...t, [p.field]: value, origem, sugerido: { ...(t.sugerido ?? {}), [p.field]: value } } }).where(eq(pieceVariants.id, r.id));
  }
  if (origem === "ia") await maybeReview(db, p.restaurantId, p.now, p.schedule ?? inline, p.reviewerGateway);
  return { ok: true, warnings: origem === "sem_ia" ? ["sem_ia"] : [] };
}

export async function approvePiece(db: Db, p: { restaurantId: string; pieceId: string; now: Date }): Promise<boolean | "revisor"> {
  const [piece] = await db.select().from(kitPieces).where(and(eq(kitPieces.id, p.pieceId), eq(kitPieces.restaurantId, p.restaurantId)));
  if (!piece) return false;
  if (await pieceBlocked(db, piece.id, p.now)) return "revisor";
  if (piece.status === "rascunho") await db.update(kitPieces).set({ status: "aprovado" }).where(eq(kitPieces.id, piece.id));
  await db.update(pieceVariants).set({ approvedAt: p.now }).where(and(eq(pieceVariants.pieceId, piece.id), sql`${pieceVariants.approvedAt} is null`));
  return true;
}

/** "Está no salão" (só peça aprovada): a peça passa a contar como divulgação (métrica de adoção — espec. 2). */
export async function markInSalon(db: Db, p: { restaurantId: string; pieceId: string; on: boolean; now: Date }): Promise<{ ok: boolean; erro?: "nao_aprovada" }> {
  const [piece] = await db.select().from(kitPieces).where(and(eq(kitPieces.id, p.pieceId), eq(kitPieces.restaurantId, p.restaurantId)));
  if (!piece) return { ok: false };
  if (piece.status === "rascunho") return { ok: false, erro: "nao_aprovada" };
  await db.update(kitPieces).set(p.on ? { status: "no_salao", inSalonAt: p.now } : { status: "aprovado", inSalonAt: null }).where(eq(kitPieces.id, piece.id));
  return { ok: true };
}

export async function editRecado(db: Db, p: { restaurantId: string; value: string; now: Date }): Promise<EditResult> {
  const ctx = await loadContext(db, p.restaurantId);
  if (!ctx) return { ok: false, erro: "nao_encontrado" };
  const k = kitCtx(ctx);
  const g = guardText(p.value, k.refCtx, { allowed: [], maxLen: FIELD_MAX.recado, field: "kit", mode: "dono" });
  if (!g.ok) return { ok: false, erro: "texto", motivos: g.reasons };
  g.warnings.push(...holdoutWarnings(p.value, k));
  await db.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "recado", ref: null, suggested: ctx.restaurant.recado, final: p.value.trim(), at: p.now });
  await db.update(restaurants).set({ recado: p.value.trim() }).where(eq(restaurants.id, p.restaurantId));
  return { ok: true, warnings: g.warnings };
}

/**
 * "Promover vencedora" (espec. 3.4, flag `ab`): só com amostra suficiente e diferença significativa. A versão
 * perdedora vira uma nova versão com o texto da vencedora (QR novo; reimprimir). Display e cartaz da mesma
 * letra compartilham o texto, então a promoção vale para as duas peças daquela letra.
 */
export async function promoteWinner(db: Db, p: { restaurantId: string; piece: "display" | "cartaz"; now: Date }): Promise<{ ok: true; winner: "A" | "B" } | { ok: false; erro: "sem_vencedora" | "nao_encontrado" }> {
  const row = abTable(await getVariantStats(db, p.restaurantId)).find((r) => r.kind === p.piece);
  if (!row?.status || row.status.state !== "vencedora") return { ok: false, erro: "sem_vencedora" };
  const winner = row.status.winner;
  const [w] = await db.select({ texts: pieceVariants.texts }).from(pieceVariants).where(eq(pieceVariants.id, (winner === "A" ? row.a : row.b)!.id));
  if (!w) return { ok: false, erro: "nao_encontrado" };
  const r = await newKitVersion(db, { restaurantId: p.restaurantId, label: winner === "A" ? "B" : "A", now: p.now, textsFrom: w.texts as VariantTexts });
  return r.ok ? { ok: true, winner } : { ok: false, erro: "nao_encontrado" };
}

/** Revisor (flag): "bloquear" ou "revisando" (até 20 s) impede aprovar e imprimir. */
export async function pieceBlocked(db: Db, pieceId: string, now: Date, variantId?: string): Promise<boolean> {
  const rows = await db
    .select({ status: pieceVariants.reviewerStatus, reasons: pieceVariants.reviewerReasons, createdAt: pieceVariants.createdAt })
    .from(pieceVariants)
    .where(and(eq(pieceVariants.pieceId, pieceId), isNull(pieceVariants.retiredAt), variantId ? eq(pieceVariants.id, variantId) : undefined));
  return rows.some((r) => r.status && reviewBlocks({ status: r.status, ...((r.reasons as { reasons: string[]; at: string } | null) ?? { reasons: [], at: r.createdAt.toISOString() }) } as StoredReview, now));
}
