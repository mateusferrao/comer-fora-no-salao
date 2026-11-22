/**
 * Valor ao dono em R$ (S5.1, D179): topo em 2 camadas e metas por faixa.
 * - Causal: margem incremental contra o grupo de controle (espec. 2), só com resultado positivo/negativo nas visitas.
 *   O tipo sai do estado da MARGEM (S9, A5): a margem já desconta o custo dos convites e pode ser negativa ou cruzar
 *   o zero mesmo com visitas a mais (oferta cara). `visitas` guarda o sinal das visitas para o texto.
 * - Antecipada (sem resultado): convites usados × ticket declarado — "estimativa, não causal".
 * Só tipos de domínio (fronteira domain-no-infra).
 */
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { MIN_N, type Incremental, type MarginIncrement } from "./incremental";

/** Convites usados = códigos de convite validados pelo garçom; custo = custo unitário de cada um. */
export type EarlyValue = { usados: number; custoCents: number };

type Faltam = { faltamControle: number; faltamConvidados: number };
export type Topline =
  | { kind: "causal_positivo" | "causal_negativo" | "causal_cruza_zero"; visitas: "positivo" | "negativo"; cents: number; lo: number; hi: number; nT: number }
  | ({ kind: "antecipado"; motivo: "amostra" | "inconclusivo"; usados: number; consumoCents: number; margemCents: number; custoCents: number; liquidoCents: number } & Faltam)
  | ({ kind: "sem_valores"; motivo: "amostra" | "inconclusivo" | "causal"; usados: number; custoCents: number } & Faltam);

export type MarginState = "positiva" | "negativa" | "cruza_zero";

/** Estado da margem incremental pelo IC (S9, A5): positiva só se o mínimo passa de zero; negativa só se o máximo fica abaixo. */
export function marginState(m: { lo: number; hi: number }): MarginState {
  if (m.lo > 0) return "positiva";
  if (m.hi < 0) return "negativa";
  return "cruza_zero";
}

const KIND: Record<MarginState, "causal_positivo" | "causal_negativo" | "causal_cruza_zero"> = { positiva: "causal_positivo", negativa: "causal_negativo", cruza_zero: "causal_cruza_zero" };

export function valueTopline(p: { inc: Incremental; margin: MarginIncrement | null; early: EarlyValue; ticketCents: number | null; marginPct: number | null; minN?: number }): Topline {
  const minN = p.minN ?? MIN_N;
  const causal = p.inc.state === "positivo" || p.inc.state === "negativo";
  const declared = p.ticketCents != null && p.marginPct != null;
  if (causal && declared && p.margin) {
    const [cents, lo, hi] = [Math.round(p.margin.cents), Math.round(p.margin.lo), Math.round(p.margin.hi)];
    return { kind: KIND[marginState({ lo, hi })], visitas: p.inc.state === "positivo" ? "positivo" : "negativo", cents, lo, hi, nT: p.inc.nT };
  }
  const amostra = p.inc.state === "amostra_insuficiente";
  const faltam: Faltam = {
    faltamControle: amostra ? Math.max(0, minN - p.inc.nH) : 0,
    faltamConvidados: amostra ? Math.max(0, minN - p.inc.nT) : 0,
  };
  const motivo = amostra ? "amostra" : "inconclusivo";
  if (!declared) return { kind: "sem_valores", motivo: causal ? "causal" : motivo, usados: p.early.usados, custoCents: p.early.custoCents, ...faltam };
  const consumoCents = p.early.usados * p.ticketCents!;
  const margemCents = Math.round((consumoCents * p.marginPct!) / 100);
  return {
    kind: "antecipado",
    motivo,
    usados: p.early.usados,
    consumoCents,
    margemCents,
    custoCents: p.early.custoCents,
    liquidoCents: margemCents - p.early.custoCents,
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
