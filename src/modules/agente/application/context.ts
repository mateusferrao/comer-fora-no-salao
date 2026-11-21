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

export async function loadAgentContext(db: Db, p: { restaurantId: string; restaurantName: string; tone?: string | null; page: string; now: Date }): Promise<CopilotInput | null> {
  const [snap, ins] = await Promise.all([loadSnapshot(db, p.restaurantId), getPlanInsights(db, p.restaurantId, p.now)]);
  if (!snap || !ins) return null;
  // Apelidos estáveis: ordem do id (C1…); nome curto (primeiro nome + inicial).
  const customers: CopilotCustomer[] = [...ins.customers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c, i) => ({ alias: `C${i + 1}`, name: shortName(c.displayName), visits: c.visits, stamps: c.stamps, lastDay: c.lastDay, segments: c.segments }));
  return {
    restaurantName: p.restaurantName,
    snap,
    facts: ins.facts,
    slotAliases: slotAliases(ins.ctx.slots).map(({ alias, slot }) => ({ alias, slotId: slot.id })),
    customers,
    plan: ins.offers.length ? { status: "veja ver_plano", slots: ins.offers.map((o) => ({ alias: o.alias, gain: o.gain, weeklyCap: o.recalibratedCap })) } : null,
    page: p.page,
    tone: p.tone ?? null,
  };
}
