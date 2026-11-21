/**
 * Fatos declarados do 1º plano (espec. 3.2 passo 4; D223): sem eventos ainda, a IA trabalha com o que o
 * dono declarou. Chaves estáveis por apelido de faixa (A, B… pela prioridade), como nos planos fixos.
 */
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import { turnOfMinutes, type Slot } from "@/src/modules/beneficios/domain/slots";

import { slotAliases } from "@/src/modules/beneficios/domain/slot-text";

const TURN_LABEL: Record<string, string> = { madrugada: "madrugada", manha: "manhã", almoco: "almoço", tarde: "tarde", noite: "noite" };

export type DeclaredRestaurant = { tables?: number | null; weeklyCustomers?: number | null; ticketCents?: number | null; marginPct?: number | null };

export function declaredFacts(r: DeclaredRestaurant, slots: readonly Slot[], menu: readonly MenuItem[]): Record<string, number | string> {
  const f: Record<string, number | string> = {};
  for (const { alias, slot } of slotAliases(slots)) {
    f[`faixa_${alias}_intensidade`] = slot.intensity === "muito" ? "muito vazia" : "um pouco vazia"; // concorda com "a faixa" (revisão da S2)
    f[`faixa_${alias}_mesas`] = slot.extraTables;
    f[`faixa_${alias}_turno`] = TURN_LABEL[turnOfMinutes(slot.startMin)]!;
  }
  if (r.ticketCents) f.ticket_medio = r.ticketCents;
  if (r.marginPct) f.margem_pct = r.marginPct;
  if (r.tables) f.mesas_total = r.tables;
  if (r.weeklyCustomers) f.clientes_semana = r.weeklyCustomers;
  for (const cat of ["entrada", "prato", "porcao", "sobremesa", "bebida"] as const) {
    const n = menu.filter((i) => i.category === cat).length;
    if (n) f[`itens_${cat}`] = n;
  }
  return f;
}
