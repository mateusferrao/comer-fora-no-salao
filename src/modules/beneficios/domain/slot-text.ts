/**
 * Texto das faixas (horários vazios) para telas e prompts: apelidos A, B…, rótulo curto e forma para frases.
 * Movido de `onboarding/domain/facts` (revisão S2 #37): é usado por planos, analytics, config, kit e MCP.
 */
import { formatDays, formatDaysLong, formatHours, sortByPriority, type Slot } from "./slots";

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
