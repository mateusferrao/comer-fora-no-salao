/**
 * Fatos declarados do 1º plano (espec. 3.2 passo 4; D223): sem eventos ainda, a IA trabalha com o que o
 * dono declarou. Chaves estáveis por apelido de faixa (A, B… pela prioridade), como nos planos fixos.
 */
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import { formatDays, formatDaysLong, formatHours, sortByPriority, turnOfMinutes, type Slot } from "@/src/modules/beneficios/domain/slots";

export const SLOT_ALIASES = "ABCDEFGH".split("");

/** Apelidos curtos das faixas, na ordem de prioridade (revisão T-I2: nada de UUID dentro do texto da IA). */
export function slotAliases(slots: readonly Slot[]): Array<{ alias: string; slot: Slot }> {
  return sortByPriority([...slots]).map((slot, i) => ({ alias: SLOT_ALIASES[i]!, slot }));
}

export function slotLabel(s: Pick<Slot, "days" | "startMin" | "endMin">): string {
  return `${formatDays(s.days)} · ${formatHours(s.startMin, s.endMin)}`;
}

/** Forma para dentro de frases ({horario} nos textos): "terça, quarta e quinta, das 15h às 18h" (revisão da S2). */
export function slotPhrase(s: Pick<Slot, "days" | "startMin" | "endMin">): string {
  return `${formatDaysLong(s.days)}, das ${formatHours(s.startMin, s.endMin).replace("–", " às ")}`;
}

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
