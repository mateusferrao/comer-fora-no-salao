/**
 * "Por que esta oferta?" (S5.3, D180, D185): explica a escolha de uma faixa num plano da semana ou no pacote da
 * ativação (os dois ficam em `weekly_plans`). Camada do dono: opções do código com a nota, escolha da IA, fatos
 * usados, regras e revisor. Camada técnica: a chamada de IA mais recente da tarefa ligada ao plano (`ai_calls.plan_id`).
 * Sempre filtrado pelo restaurante da sessão (revisão técnica I2). Sem PII: só nomes de pratos e chaves de fatos.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { aiCalls, idleSlots, menuItems, weeklyPlans } from "@/src/db/schema";
import { describeOffer, type Offer, type OfferKind } from "@/src/modules/beneficios/domain/offers";
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import { slotAliases, slotLabel, slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import type { Intensity } from "@/src/modules/beneficios/domain/slots";
import { factLabel } from "@/src/modules/textos/domain/fact-labels";
import { formatFact, referencesIn, renderReferences } from "@/src/modules/textos/domain/references";
import type { StoredReview } from "@/src/modules/ia/tasks/reviewer";

export type ExplainOption = { id: string; title: string; gain: string; unitCostCents: number; score: number; maiorNota: boolean; escolhaIa: boolean; escolhaDono: boolean };
export type ExplainAttempt = { model: string; ok: boolean; error: string | null; notes: string[] };
export type OfferExplanation = {
  kind: "plano" | "pacote";
  slotLabel: string;
  modo: "ia" | "sem_ia" | "fixo";
  semIa: string | null;
  opcoes: ExplainOption[];
  escolhida: string | null;
  justificativa: string;
  fatos: Array<{ key: string; label: string; value: string }>;
  revisor: { status: StoredReview["status"]; reasons: string[] } | null;
  /** Plano montado por agente (S6.3b — D194): os passos, com rótulos legíveis. */
  passos: Array<{ label: string; ms: number }>;
  tecnico: { task: string; model: string | null; servedModel: string | null; provider: string | null; reserva: boolean; attempts: ExplainAttempt[]; costUsd: number; latencyMs: number; promptVersion: string } | null;
};

type StoredOption = { id: string; offer: { kind: OfferKind; itemId: string; pct?: number }; score: number; unitCostCents: number };
const toOffer = (o: StoredOption["offer"]): Offer => ({ kind: o.kind, params: { itemId: o.itemId, ...(o.pct !== undefined ? { pct: o.pct } : {}) } });

export async function explainOffer(db: Db, restaurantId: string, planId: string, slotId: string): Promise<OfferExplanation | null> {
  const [plan] = await db.select().from(weeklyPlans).where(and(eq(weeklyPlans.id, planId), eq(weeklyPlans.restaurantId, restaurantId))).limit(1);
  if (!plan || plan.status === "gerando") return null;
  const [slot] = await db.select().from(idleSlots).where(and(eq(idleSlots.id, slotId), eq(idleSlots.restaurantId, restaurantId))).limit(1);
  if (!slot) return null;
  const menu = (await db.select({ id: menuItems.id, name: menuItems.name, category: menuItems.category, priceCents: menuItems.priceCents }).from(menuItems).where(eq(menuItems.restaurantId, restaurantId))) as MenuItem[];

  const decision = (plan.decision ?? {}) as { agora?: unknown; semIa?: string; aiChoices?: Array<{ slotId: string; candidateId: string }> | null; topScore?: Record<string, string | null>; reviewer?: StoredReview };
  const kind = decision.agora ? "pacote" : "plano";
  const texts = (plan.texts ?? {}) as { generatedBy?: "ia" | "sem_ia" | "fixo" };
  const cands = (plan.candidates ?? []) as Array<{ slotId: string; options: StoredOption[] }>;
  const choices = (plan.choices ?? []) as Array<{ slotId: string; candidateId: string; justificativa?: string }>;
  const options = cands.find((c) => c.slotId === slotId)?.options ?? [];
  const aiPick = decision.aiChoices?.find((c) => c.slotId === slotId)?.candidateId ?? null;
  const ownerPick = choices.find((c) => c.slotId === slotId)?.candidateId ?? null;
  const top = decision.topScore?.[slotId] ?? options[0]?.id ?? null;
  const opcoes: ExplainOption[] = options.map((o) => {
    const d = describeOffer(toOffer(o.offer), menu, "convite");
    return { id: o.id, title: d.title, gain: d.gain, unitCostCents: o.unitCostCents, score: o.score, maiorNota: o.id === top, escolhaIa: o.id === aiPick, escolhaDono: o.id === ownerPick };
  });

  const facts = (plan.facts ?? {}) as Record<string, number | string>;
  const raw = choices.find((c) => c.slotId === slotId)?.justificativa ?? "";
  const chosenGain = opcoes.find((o) => o.escolhaDono)?.gain ?? opcoes.find((o) => o.escolhaIa)?.gain;
  const rctx = { facts, items: Object.fromEntries(menu.map((m) => [m.id, m.name])), slots: { [slot.id]: slotPhrase(slot) }, oferta: chosenGain };
  // S9: o dono vê o horário ("ter a qui · 15h–18h"), não o apelido "A". Mesmas faixas e mesma ordem do plano
  // (`loadContext`: ativas, por posição; `slotAliases` ordena por prioridade), numa consulta só.
  const slotRows = await db
    .select({ id: idleSlots.id, days: idleSlots.days, startMin: idleSlots.startMin, endMin: idleSlots.endMin, intensity: idleSlots.intensity, extraTables: idleSlots.extraTables })
    .from(idleSlots)
    .where(and(eq(idleSlots.restaurantId, restaurantId), eq(idleSlots.active, true)))
    .orderBy(asc(idleSlots.position), asc(idleSlots.createdAt));
  const slotNames: Record<string, string> = Object.fromEntries(slotAliases(slotRows.map((s) => ({ ...s, intensity: s.intensity as Intensity }))).map((a) => [a.alias, slotLabel(a.slot)]));
  const keys = [...new Set(referencesIn(raw).filter((r) => r.kind === "fato" && facts[r.key] !== undefined).map((r) => r.key))];

  // Plano por agente (S6.3b): a chamada que valeu é a do agente quando ele deu certo; senão, a chamada única.
  const steps = ((plan.agentSteps ?? []) as Array<{ label: string; ms: number }>).map((x) => ({ label: x.label, ms: x.ms }));
  const task = kind === "pacote" ? "pacote" : steps.length ? "plano_agente" : "plano";
  const [call] = await db.select().from(aiCalls).where(and(eq(aiCalls.planId, plan.id), eq(aiCalls.task, task), eq(aiCalls.restaurantId, restaurantId))).orderBy(desc(aiCalls.at)).limit(1);
  const attempts = ((call?.attempts ?? []) as Array<{ model: string; ok: boolean; error: string | null; notes?: string[] }>).map((a) => ({ model: a.model, ok: a.ok, error: a.error ?? null, notes: a.notes ?? [] }));
  const served = call?.servedModel ?? call?.model ?? null;

  return {
    kind,
    slotLabel: slotLabel(slot),
    modo: texts.generatedBy ?? (decision.semIa ? "sem_ia" : "ia"),
    semIa: decision.semIa ?? null,
    opcoes,
    escolhida: chosenGain ?? null,
    justificativa: renderReferences(raw, rctx),
    fatos: keys.map((k) => ({ key: k, label: factLabel(k, slotNames), value: formatFact(k, facts[k]!) })),
    passos: steps,
    revisor: kind === "pacote" ? null : decision.reviewer ? { status: decision.reviewer.status, reasons: decision.reviewer.reasons ?? [] } : null,
    tecnico: call
      ? {
          task,
          model: call.model,
          servedModel: served,
          provider: served?.split("/")[0] ?? null,
          reserva: call.status === "ok" && attempts.length > 1,
          attempts,
          costUsd: Number(call.costUsd ?? 0),
          latencyMs: call.latencyMs ?? 0,
          promptVersion: call.promptVersion,
        }
      : null,
  };
}
