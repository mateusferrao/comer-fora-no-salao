/**
 * Incremento contra o holdout (espec. 2, D217): Welch com aproximação normal, IC 95%, 4 estados.
 * Margem incremental por Δcusto entre os grupos (o "agora", que os dois recebem, se cancela).
 */
import { addDaysSP, weekKeyOfDay } from "@/src/shared/week";

export type IncrementalState = "amostra_insuficiente" | "inconclusivo" | "positivo" | "negativo";
export type Incremental =
  | { state: "amostra_insuficiente"; nT: number; nH: number }
  | { state: Exclude<IncrementalState, "amostra_insuficiente">; nT: number; nH: number; diff: number; se: number; lo: number; hi: number };

export const MIN_N = 30;
const Z95 = 1.96;

function mean(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Variância amostral (n − 1). */
function sampleVar(xs: readonly number[]): number {
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
}

export function welch(t: readonly number[], h: readonly number[], minN = MIN_N): Incremental {
  const nT = t.length;
  const nH = h.length;
  if (nT < minN || nH < minN || nT < 2 || nH < 2) return { state: "amostra_insuficiente", nT, nH };
  const diff = mean(t) - mean(h);
  const se = Math.sqrt(sampleVar(t) / nT + sampleVar(h) / nH);
  const lo = diff - Z95 * se;
  const hi = diff + Z95 * se;
  const state = se === 0 || (lo <= 0 && hi >= 0) ? "inconclusivo" : diff > 0 ? "positivo" : "negativo";
  return { state, nT, nH, diff, se, lo, hi };
}

export type MarginIncrement = { cents: number; lo: number; hi: number };

/** `diff · nC · ticket · margem% − Δcusto`, com `Δcusto = custoConv − custoHold · nC/nH`; IC linear. */
export function marginIncrement(p: {
  inc: Incremental;
  ticketCents: number | null;
  marginPct: number | null;
  costConvCents: number;
  costHoldCents: number;
}): MarginIncrement | null {
  if (p.inc.state === "amostra_insuficiente" || p.ticketCents == null || p.marginPct == null) return null;
  const { nT, nH } = p.inc;
  const k = nT * p.ticketCents * (p.marginPct / 100);
  const deltaCost = p.costConvCents - (p.costHoldCents * nT) / nH;
  return { cents: p.inc.diff * k - deltaCost, lo: p.inc.lo * k - deltaCost, hi: p.inc.hi * k - deltaCost };
}

export type CohortRow = { weekKey: string; issued: number; used: number; pct: number; open: boolean };

/** Uso dos convites por coorte (semana ISO de emissão em SP): usados em até `windowDays`; janela aberta = em aberto. */
export function cohorts(invites: ReadonlyArray<{ issuedDay: string; usedDay: string | null }>, today: string, windowDays: number): CohortRow[] {
  const by = new Map<string, CohortRow>();
  for (const inv of invites) {
    const key = weekKeyOfDay(inv.issuedDay);
    const row = by.get(key) ?? { weekKey: key, issued: 0, used: 0, pct: 0, open: false };
    row.issued++;
    const limit = addDaysSP(inv.issuedDay, windowDays);
    if (inv.usedDay && inv.usedDay <= limit) row.used++;
    if (limit >= today) row.open = true;
    by.set(key, row);
  }
  return [...by.values()].sort((a, b) => a.weekKey.localeCompare(b.weekKey)).map((r) => ({ ...r, pct: r.issued ? r.used / r.issued : 0 }));
}
