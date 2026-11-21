/**
 * Próxima janela em que o código do convite pode nascer (S5.2, D185; espec. 3.3): dentro da faixa congelada na
 * emissão, num dia DIFERENTE do da emissão (`decide-checkin`) e antes do vencimento. Alimenta o `.ics` e a faixa
 * "Seu convite vale hoje" da Jornada.
 */
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { daySP, instantSP } from "@/src/shared/tz";
import { addDaysSP, weekdayOfDay } from "@/src/shared/week";

export type InviteWindow = { day: string; start: Date; end: Date };

export function nextValidWindow(p: { slot: Pick<Slot, "days" | "startMin" | "endMin">; issuedDay: string; expiresAt: Date; now: Date }): InviteWindow | null {
  if (!p.slot.days.length || p.slot.endMin <= p.slot.startMin) return null;
  const today = daySP(p.now);
  const dayAfter = addDaysSP(p.issuedDay, 1);
  let day = today > dayAfter ? today : dayAfter;
  for (let i = 0; i < 8; i++, day = addDaysSP(day, 1)) {
    if (!p.slot.days.includes(weekdayOfDay(day))) continue;
    const start = instantSP(day, p.slot.startMin);
    const end = instantSP(day, p.slot.endMin);
    if (end.getTime() <= p.now.getTime()) continue;
    if (start.getTime() >= p.expiresAt.getTime()) return null;
    return { day, start, end: end.getTime() > p.expiresAt.getTime() ? p.expiresAt : end };
  }
  return null;
}
