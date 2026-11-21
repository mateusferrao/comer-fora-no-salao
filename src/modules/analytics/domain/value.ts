/**
 * Valor ao dono em R$ (S5.1, D179): topo em 2 camadas e metas por faixa.
 * - Causal: margem incremental contra o grupo de controle (espec. 2), só com resultado positivo/negativo.
 * - Antecipada (sem resultado): convites usados × ticket declarado — "estimativa, não causal".
 * Só tipos de domínio (fronteira domain-no-infra).
 */
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { MIN_N, type Incremental, type MarginIncrement } from "./incremental";

/** Convites usados = códigos de convite validados pelo garçom; custo = custo unitário de cada um. */
export type EarlyValue = { usados: number; custoCents: number };

type Faltam = { faltamControle: number; faltamConvidados: number };
export type Topline =
  | { kind: "causal_positivo" | "causal_negativo"; cents: number; lo: number; hi: number; nT: number }
  | ({ kind: "antecipado"; motivo: "amostra" | "inconclusivo"; usados: number; consumoCents: number; margemCents: number; custoCents: number } & Faltam)
  | ({ kind: "sem_valores"; motivo: "amostra" | "inconclusivo" | "causal"; usados: number; custoCents: number } & Faltam);

export function valueTopline(p: { inc: Incremental; margin: MarginIncrement | null; early: EarlyValue; ticketCents: number | null; marginPct: number | null; minN?: number }): Topline {
  const minN = p.minN ?? MIN_N;
  const causal = p.inc.state === "positivo" || p.inc.state === "negativo";
  const declared = p.ticketCents != null && p.marginPct != null;
  if (causal && declared && p.margin) {
    return { kind: p.inc.state === "positivo" ? "causal_positivo" : "causal_negativo", cents: Math.round(p.margin.cents), lo: Math.round(p.margin.lo), hi: Math.round(p.margin.hi), nT: p.inc.nT };
  }
  const amostra = p.inc.state === "amostra_insuficiente";
  const faltam: Faltam = {
    faltamControle: amostra ? Math.max(0, minN - p.inc.nH) : 0,
    faltamConvidados: amostra ? Math.max(0, minN - p.inc.nT) : 0,
  };
  const motivo = amostra ? "amostra" : "inconclusivo";
  if (!declared) return { kind: "sem_valores", motivo: causal ? "causal" : motivo, usados: p.early.usados, custoCents: p.early.custoCents, ...faltam };
  const consumoCents = p.early.usados * p.ticketCents!;
  return {
    kind: "antecipado",
    motivo,
    usados: p.early.usados,
    consumoCents,
    margemCents: Math.round((consumoCents * p.marginPct!) / 100),
    custoCents: p.early.custoCents,
    ...faltam,
  };
}

export type SlotGoal = { slotId: string; days: number[]; startMin: number; endMin: number; metaMesas: number; usados: number; emitidos: number; teto: number | null };

/**
 * Metas da semana por faixa ativa: `usados` = convites validados na semana (por dia de validação), `emitidos`/`teto`
 * = cota da semana; sem cota (nenhum convite ainda), o teto de reserva (plano aprovado ou mesas × 4).
 */
export function slotGoals(
  slots: readonly Slot[],
  usedBySlot: ReadonlyMap<string, number>,
  quotaBySlot: ReadonlyMap<string, { used: number; cap: number }>,
  capFallback: ReadonlyMap<string, number>,
): SlotGoal[] {
  return slots.map((s) => {
    const q = quotaBySlot.get(s.id);
    return {
      slotId: s.id,
      days: s.days,
      startMin: s.startMin,
      endMin: s.endMin,
      metaMesas: s.extraTables,
      usados: usedBySlot.get(s.id) ?? 0,
      emitidos: q?.used ?? 0,
      teto: q?.cap ?? capFallback.get(s.id) ?? null,
    };
  });
}
