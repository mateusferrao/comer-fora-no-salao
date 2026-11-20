/** Semana ISO e aritmética de dias no fuso de SP (teto de convites por semana — espec. 3.3). */
import { daySP, instantSP } from "./tz";

export { instantSP };

const DAY_MS = 86_400_000;

function parseDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function formatDay(utcMidnight: number): string {
  return new Date(utcMidnight).toISOString().slice(0, 10);
}

/** Soma `n` dias ao dia de SP `YYYY-MM-DD` (aritmética de calendário, sem fuso). */
export function addDaysSP(day: string, n: number): string {
  return formatDay(parseDay(day) + n * DAY_MS);
}

/** Dias de `a` até `b` (positivo se `b` vem depois). */
export function dayDiff(a: string, b: string): number {
  return Math.round((parseDay(b) - parseDay(a)) / DAY_MS);
}

/** Dia da semana (0 = dom … 6 = sáb) de um dia de calendário. */
export function weekdayOfDay(day: string): number {
  return new Date(parseDay(day)).getUTCDay();
}

/** Semana ISO (segunda a domingo) do dia de SP: `"2026-W48"`. */
export function weekKeyOfDay(day: string): string {
  const t = parseDay(day);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // 0 = segunda
  const thursday = t + (3 - dow) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.floor((thursday - jan1) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function weekKeySP(at: Date): string {
  return weekKeyOfDay(daySP(at));
}
