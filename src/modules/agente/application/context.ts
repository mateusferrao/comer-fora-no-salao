/**
 * Contexto do agente (S8 — D267): o mesmo para o copiloto e para o MCP. Retrato das Configurações, fatos do código
 * (os do plano da semana) e clientes com apelido e nome curto, nunca contato (D262, D268).
 */
import type { Db } from "@/src/db/client";
import { slotAliases } from "@/src/modules/beneficios/domain/slot-text";
import { getPlanInsights } from "@/src/modules/planos/application/insights";
import { shortName } from "@/src/shared/name";
import type { CopilotCustomer, CopilotInput } from "@/src/modules/ia/tasks/copilot";
import { loadSnapshot } from "./proposals";
import { latestPlan } from "@/src/modules/planos/application/approve-plan";
import { loadContext } from "@/src/modules/salao/application/context";

/** Nome digitado pelo cliente que parece contato ou link não vai ao modelo nem ao MCP (revisão S8, segurança 4). */
export function safeName(full: string | null | undefined): string {
  const n = shortName(full);
  return /[@\d]|https?:|www\.|\.(com|br|net)\b/i.test(n) ? "Cliente" : n;
}

export async function loadAgentContext(db: Db, p: { restaurantId: string; restaurantName: string; tone?: string | null; page: string; now: Date }): Promise<CopilotInput | null> {
  // Um só `loadContext` para o retrato e os fatos (antes eram 2 em paralelo — revisão S8, item 23).
  const ctx = await loadContext(db, p.restaurantId);
  if (!ctx) return null;
  const [snap, ins, lp] = await Promise.all([loadSnapshot(db, p.restaurantId, { ctx }), getPlanInsights(db, p.restaurantId, p.now, ctx), latestPlan(db, p.restaurantId)]);
  if (!snap || !ins) return null;
  // Apelidos estáveis: ordem do id (C1…); nome curto (primeiro nome + inicial).
  const customers: CopilotCustomer[] = [...ins.customers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c, i) => ({ alias: `C${i + 1}`, name: safeName(c.displayName), visits: c.visits, stamps: c.stamps, lastDay: c.lastDay, segments: c.segments }));
  return {
    restaurantName: p.restaurantName,
    snap,
    facts: ins.facts,
    slotAliases: slotAliases(ins.ctx.slots).map(({ alias, slot }) => ({ alias, slotId: slot.id })),
    customers,
    plan: lp ? { id: lp.id, status: lp.status, slots: ins.offers.map((o) => ({ alias: o.alias, gain: o.gain, weeklyCap: o.recalibratedCap })) } : null,
    page: p.page,
    tone: p.tone ?? null,
  };
}
