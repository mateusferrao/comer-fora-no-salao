/**
 * Passo 4 — pacote proposto (espec. 3.2; D205, D121): o código propõe o "agora", a recompensa e as
 * candidatas; a IA escolhe por faixa e escreve; sem IA, a maior nota com texto modelo (rotulado).
 * O rascunho fica em `weekly_plans` (status `gerando` → `proposto`); ativar o aprova.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Executor } from "@/src/db/executor";
import { idleSlots, menuItems, owners, restaurants, weeklyPlans } from "@/src/db/schema";
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import { describeOffer, unitCost, type Offer } from "@/src/modules/beneficios/domain/offers";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { renderReferences } from "@/src/modules/textos/domain/references";
import { GENERATING_STALE_MS, startGenerating } from "@/src/modules/planos/application/generating";
import { weekKeySP } from "@/src/shared/week";
import { consume } from "@/src/shared/rate-limit";
import { systemClock } from "@/src/shared/clock";
import { getActivePrompt, promptSuffix } from "@/src/modules/config/application/app-config";
import { recordAiCall } from "@/src/modules/ia/ai-calls";
import { gatewayFor, keyKindFor } from "@/src/modules/ia/gateway-factory";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { MODELS } from "@/src/modules/ia/models";
import { runTask } from "@/src/modules/ia/run-task";
import { langfuseTracer } from "@/src/modules/ia/tracing";
import { buildPackagePrompt, buildPackageTask, PACKAGE_PROMPT_VERSION, resolvePackage } from "@/src/modules/ia/tasks/package";
import { buildCandidates, fallbackChoices, proposeAgora, proposeRecompensa, toPlanCandidate, type SlotCandidates } from "../domain/candidates";
import { declaredFacts, slotAliases, slotLabel, slotPhrase } from "../domain/facts";

export { GENERATING_STALE_MS };
/** Texto modelo do modo sem IA [C]: só referências, o código escreve horário e oferta. */
export const FALLBACK_INVITE_TEXT = "Volte {horario} e aproveite {oferta}.";

export type Draft = { restaurant: typeof restaurants.$inferSelect; menu: MenuItem[]; slots: Slot[] };

export async function loadDraft(ex: Executor, restaurantId: string): Promise<Draft | null> {
  const [restaurant] = await ex.select().from(restaurants).where(eq(restaurants.id, restaurantId));
  if (!restaurant) return null;
  const items = await ex.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurantId), eq(menuItems.active, true))).orderBy(asc(menuItems.position));
  const slots = await ex.select().from(idleSlots).where(and(eq(idleSlots.restaurantId, restaurantId), eq(idleSlots.active, true))).orderBy(asc(idleSlots.position));
  return {
    restaurant,
    menu: items.map((i) => ({ id: i.id, category: i.category as MenuItem["category"], name: i.name, priceCents: i.priceCents })),
    slots: slots.map((s) => ({ id: s.id, days: s.days, startMin: s.startMin, endMin: s.endMin, intensity: s.intensity as Slot["intensity"], extraTables: s.extraTables })),
  };
}

export type PlanDecision = { agora: Offer; recompensa: Offer; semIa?: string };
type StoredChoice = { slotId: string; candidateId: string; textoConvite: string; justificativa: string };

export type ProposeResult = { ok: true; planId: string } | { ok: false; erro: "gerando" | "limite" | "incompleto"; retryAfterSec?: number };

export async function proposePackage(db: Db, p: { restaurantId: string; ownerId: string; now: Date; gateway?: AiGateway | null }): Promise<ProposeResult> {
  const draft = await loadDraft(db, p.restaurantId);
  if (!draft || !draft.menu.length || !draft.slots.length) return { ok: false, erro: "incompleto" };
  const [owner] = await db.select({ via: owners.via, emailHmac: owners.emailHmac }).from(owners).where(eq(owners.id, p.ownerId));
  // Estado `gerando` por restaurante, decidido sob lock da linha do restaurante: clique duplo → 1 chamada.
  const started = await startGenerating(db, { restaurantId: p.restaurantId, now: p.now, limitKey: `pacote:${p.restaurantId}`, limit: 10, exempt: owner?.via === "e2e", clearStatuses: ["gerando", "proposto", "vencido"] });
  if (!started.ok) return started;
  const plan = { id: started.planId };

  const agora = proposeAgora(draft.menu)!;
  const recompensa = proposeRecompensa(draft.menu)!;
  const r = draft.restaurant;
  const agoraItem = draft.menu.find((m) => m.id === agora.params.itemId);
  const cands = buildCandidates(draft.slots, draft.menu, { ticketCents: r.ticketCents, marginPct: r.marginPct, exclude: [agora.params.itemId, recompensa.params.itemId], minValueCents: agoraItem?.priceCents });
  const facts = declaredFacts(r, draft.slots, draft.menu);
  const prompt = await getActivePrompt(db, "pacote");
  const pp = buildPackagePrompt({ restaurantName: r.name, cuisine: r.cuisine, slots: draft.slots, cands, menu: draft.menu, facts, instructions: prompt.instructions, tone: r.aiTone });

  let choices: StoredChoice[] | null = null;
  let semIa: string | undefined;
  const keyKind = keyKindFor({ emailHmac: owner?.emailHmac ?? null, via: owner?.via ?? null });
  const choice = p.gateway !== undefined ? { gateway: p.gateway, keyKind, reason: p.gateway ? undefined : ("sem_chave" as const) } : await gatewayFor(db, keyKind, p.now);
  const hasCandidates = cands.some((c) => c.options.length > 0);
  if (choice.gateway && hasCandidates && cands.every((c) => c.options.length > 0)) {
    const res = await runTask(buildPackageTask(pp, MODELS.pacote), pp.system, { text: pp.text }, { gateway: choice.gateway, clock: systemClock, trace: langfuseTracer });
    await recordAiCall(db, { task: "pacote", promptVersion: `${PACKAGE_PROMPT_VERSION}${promptSuffix(prompt, { tone: !!r.aiTone })}`, restaurantId: p.restaurantId, result: res, keyKind: choice.keyKind });
    if (res.status === "ok") choices = resolvePackage(pp, res.data);
    else semIa = res.reason;
  } else semIa = !hasCandidates || !cands.every((c) => c.options.length > 0) ? "sem_candidatas" : choice.reason;

  if (!choices) {
    choices = fallbackChoices(draft.slots, cands).map((c) => ({ ...c, textoConvite: FALLBACK_INVITE_TEXT.replace("{horario}", `{horario:${c.slotId}}`), justificativa: "" }));
  }
  const order = slotAliases(draft.slots).map((a) => a.slot.id);
  // "IA ≠ maior nota" (Qualidade da IA): guarda a escolha original da IA e a de maior nota por faixa.
  const decision: PlanDecision & { aiChoices: Array<{ slotId: string; candidateId: string }> | null; topScore: Record<string, string | null> } = {
    agora,
    recompensa,
    ...(semIa ? { semIa } : {}),
    aiChoices: semIa ? null : choices.map((c) => ({ slotId: c.slotId, candidateId: c.candidateId })),
    topScore: Object.fromEntries(cands.map((c) => [c.slotId, c.options[0]?.id ?? null])),
  };
  await db
    .update(weeklyPlans)
    .set({
      status: "proposto",
      facts,
      candidates: cands.map((c) => ({ slotId: c.slotId, options: c.options.map(toPlanCandidate) })),
      choices,
      texts: { order, generatedBy: semIa ? "sem_ia" : "ia", version: 1 },
      decision,
    })
    .where(eq(weeklyPlans.id, plan!.id));
  return { ok: true, planId: plan!.id };
}

// ---------- Vista do pacote para a tela ----------

export type OptionView = { id: string; offer: Offer; title: string; gain: string; unitCostCents: number; isMax: boolean; score: number };
export type SlotPackageView = {
  slotId: string;
  label: string;
  days: number[];
  startMin: number;
  endMin: number;
  intensity: Slot["intensity"];
  extraTables: number;
  options: OptionView[];
  chosenId: string | null;
  inviteText: string;
  inviteRendered: string;
  justificativa: string;
  weeklyCap: number;
};
export type PackageView = {
  planId: string;
  status: string;
  generatedBy: "ia" | "sem_ia" | "fixo";
  semIa?: string;
  agora: { offer: Offer; title: string; gain: string; unitCostCents: number; isMax: boolean };
  recompensa: { offer: Offer; title: string; gain: string };
  slots: SlotPackageView[];
  marginDeclared: boolean;
  marginPct: number | null;
  menu: MenuItem[];
  /** Ajustes do dono guardados entre o passo 4 e o 5 (retomável). */
  draftFinal: unknown | null;
};

export async function getPackageView(db: Db, restaurantId: string, now: Date): Promise<PackageView | { status: "gerando" } | null> {
  const [plan] = await db.select().from(weeklyPlans).where(eq(weeklyPlans.restaurantId, restaurantId)).orderBy(desc(weeklyPlans.createdAt)).limit(1);
  if (!plan) return null;
  if (plan.status === "gerando") return now.getTime() - plan.createdAt.getTime() < GENERATING_STALE_MS ? { status: "gerando" } : null;
  const draft = await loadDraft(db, restaurantId);
  if (!draft) return null;
  const decision = plan.decision as PlanDecision;
  const cands = plan.candidates as Array<{ slotId: string; options: Array<{ id: string; offer: { kind: Offer["kind"]; itemId: string; pct?: number }; score: number; unitCostCents: number; weeklyCap: number }> }>;
  const choices = plan.choices as StoredChoice[];
  const margin = draft.restaurant.marginPct ?? undefined;
  const items = Object.fromEntries(draft.menu.map((m) => [m.id, m.name]));
  const slotsCtx = Object.fromEntries(draft.slots.map((s) => [s.id, slotPhrase(s)]));
  const agoraText = describeOffer(decision.agora, draft.menu, "agora");
  const agoraCost = unitCost(decision.agora, draft.menu, margin);
  const texts = plan.texts as { generatedBy?: "ia" | "sem_ia" | "fixo" };
  return {
    planId: plan.id,
    status: plan.status,
    generatedBy: texts.generatedBy ?? "sem_ia",
    semIa: decision.semIa,
    agora: { offer: decision.agora, title: agoraText.title, gain: agoraText.gain, unitCostCents: agoraCost.cents, isMax: agoraCost.isMax },
    recompensa: { offer: decision.recompensa, ...describeOffer(decision.recompensa, draft.menu, "recompensa") },
    marginDeclared: margin !== undefined,
    marginPct: draft.restaurant.marginPct ?? null,
    menu: draft.menu,
    draftFinal: (plan.decision as { draftFinal?: unknown } | null)?.draftFinal ?? null,
    slots: draft.slots.map((s) => {
      const opts = (cands.find((c) => c.slotId === s.id)?.options ?? []).map((o) => {
        const offer: Offer = { kind: o.offer.kind, params: { itemId: o.offer.itemId, ...(o.offer.pct !== undefined ? { pct: o.offer.pct } : {}) } };
        const d = describeOffer(offer, draft.menu, "convite");
        return { id: o.id, offer, title: d.title, gain: d.gain, unitCostCents: o.unitCostCents, isMax: margin === undefined && offer.kind !== "desconto", score: o.score };
      });
      const ch = choices.find((c) => c.slotId === s.id);
      const chosen = opts.find((o) => o.id === ch?.candidateId) ?? null;
      const ctx = { facts: plan.facts as Record<string, number | string>, items, slots: slotsCtx, oferta: chosen?.gain };
      const inviteText = ch?.textoConvite ?? "";
      return {
        slotId: s.id,
        label: slotLabel(s),
        days: s.days,
        startMin: s.startMin,
        endMin: s.endMin,
        intensity: s.intensity,
        extraTables: s.extraTables,
        options: opts,
        chosenId: chosen?.id ?? null,
        inviteText,
        inviteRendered: renderReferences(inviteText, ctx),
        justificativa: renderReferences(ch?.justificativa ?? "", ctx),
        weeklyCap: Math.max(1, s.extraTables * 4),
      };
    }),
  };
}

export type { SlotCandidates };
