/**
 * Reativação do plano da semana (espec. 3.3, 3.7.5; D142, D216): função pura única, usada pelo produto e pelo
 * simulador ("mesmas regras" — espec. 3.8).
 * - Público = (1 visita e sumiu ∪ perto da recompensa) − frequentes − quem já tem convite ativo − sem opt-in.
 * - Cota por faixa = 50% do teto livre (D142), decidida ANTES do sorteio do grupo: sem vaga, pula nos dois
 *   grupos (intenção de tratar). Convidável → real (consome a cota); holdout → fantasma (não consome).
 */
import { decideInvite, type Arm, type InviteIssue } from "@/src/modules/salao/domain/experiment";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import type { Segment } from "@/src/modules/analytics/domain/segments";

export const REACTIVATION_SHARE_PCT = 50;

export type ReactivationCustomer = { id: string; arm: Arm | null; optIn: boolean; segments: readonly Segment[]; hasActiveInvite: boolean; lastDay: string | null };

export function reactivationQuota(remaining: Record<string, number>, sharePct: number): Record<string, number> {
  return Object.fromEntries(Object.entries(remaining).map(([k, v]) => [k, Math.max(0, Math.floor((Math.max(0, v) * sharePct) / 100))]));
}

export function reactivationAudience(cs: readonly ReactivationCustomer[]): ReactivationCustomer[] {
  return cs
    .filter((c) => c.optIn && !c.hasActiveInvite && !c.segments.includes("frequente") && (c.segments.includes("sumiu") || c.segments.includes("perto")))
    .sort((a, b) => ((a.lastDay ?? "") < (b.lastDay ?? "") ? -1 : (a.lastDay ?? "") > (b.lastDay ?? "") ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function reactivationPlan(
  customers: readonly ReactivationCustomer[],
  slots: readonly Slot[],
  remaining: Record<string, number>,
  o: { sharePct: number; restaurantId: string },
  at: Date,
): Array<{ customerId: string; decision: InviteIssue }> {
  const quota = reactivationQuota(remaining, o.sharePct);
  const out: Array<{ customerId: string; decision: InviteIssue }> = [];
  for (const c of reactivationAudience(customers)) {
    const d = decideInvite({ customerId: c.id, restaurantId: o.restaurantId, ruleActive: slots.length > 0, hasActiveInvite: false, slots: [...slots], remaining: quota, arm: c.arm }, at);
    if (d.kind !== "real" && d.kind !== "fantasma") continue;
    if (d.kind === "real") quota[d.slotId] = (quota[d.slotId] ?? 0) - 1;
    out.push({ customerId: c.id, decision: d });
  }
  return out;
}
