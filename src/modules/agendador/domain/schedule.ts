/**
 * Agendador (S6.1 — D187, D189, D196): quando o plano é gerado, quando o resumo sai e quando o lembrete do convite
 * sai, no fuso de SP. Funções puras; o tique (aplicação) decide o resto com reservas idempotentes no banco.
 * - T = dia (0 = dom … 6 = sáb) e hora escolhidos pelo dono, na semana ISO (segunda a domingo).
 * - Recuperação: até T + 24 h (o processo pode ter estado fora); a semana (`weekKey`) sai do próprio T, inclusive
 *   na virada (revisão técnica I8).
 */
import { daySP, instantSP } from "@/src/shared/tz";
import { addDaysSP, weekKeyOfDay } from "@/src/shared/week";

export type DigestSchedule = { weekday: number; minute: number };
export type Due = { at: Date; weekKey: string };

export const RECOVERY_MS = 24 * 3_600_000;
export const PLAN_LEAD_MS = 30 * 60_000;
export const REMINDER_FLOOR_MIN = 7 * 60;

/** Segunda-feira da semana ISO do dia. */
function mondayOf(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = dom
  return addDaysSP(day, -((dow + 6) % 7));
}

/** T da semana ISO que contém `day`. */
export function scheduledAt(day: string, s: DigestSchedule): Due {
  const monday = mondayOf(day);
  const target = addDaysSP(monday, (s.weekday + 6) % 7);
  return { at: instantSP(target, s.minute), weekKey: weekKeyOfDay(monday) };
}

function dueIn(now: Date, s: DigestSchedule, leadMs: number): Due | null {
  const today = daySP(now);
  // Semana anterior, atual e seguinte: cobre a recuperação na virada e a geração antecipada antes de uma segunda 00:00.
  for (const offset of [-7, 0, 7]) {
    const d = scheduledAt(addDaysSP(today, offset), s);
    const t = d.at.getTime();
    if (now.getTime() >= t - leadMs && now.getTime() < t + RECOVERY_MS) return d;
  }
  return null;
}

/** O resumo está devido (de T até T + 24 h)? */
export function digestDue(now: Date, s: DigestSchedule): Due | null {
  return dueIn(now, s, 0);
}

/** A geração automática do plano está devida (de T − 30 min até T + 24 h)? */
export function planDue(now: Date, s: DigestSchedule): Due | null {
  return dueIn(now, s, PLAN_LEAD_MS);
}

/** Horário do lembrete: X h antes do início, nunca antes das 07h do dia; `null` se não sobrar tempo antes do início. */
export function reminderAt(windowStart: Date, hoursBefore: number): Date | null {
  const floor = instantSP(daySP(windowStart), REMINDER_FLOOR_MIN).getTime();
  const t = Math.max(floor, windowStart.getTime() - hoursBefore * 3_600_000);
  return t < windowStart.getTime() ? new Date(t) : null;
}

export function reminderDue(now: Date, windowStart: Date, hoursBefore: number): boolean {
  const t = reminderAt(windowStart, hoursBefore);
  return !!t && now.getTime() >= t.getTime() && now.getTime() < windowStart.getTime();
}
