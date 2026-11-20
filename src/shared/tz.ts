/**
 * Datas de negócio no fuso de São Paulo (D47). O banco guarda UTC; o dia de negócio é `day_sp`.
 * Nada de fuso fixo (−3): o offset é lido do Intl, então uma volta do horário de verão não quebra nada.
 */
export const TZ_SP = "America/Sao_Paulo";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ_SP,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type WallTime = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

function wallTimeSP(date: Date): WallTime {
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  const num = (k: string) => Number(parts[k]);
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour"),
    minute: num("minute"),
    second: num("second"),
    weekday: WEEKDAYS.indexOf(parts.weekday as (typeof WEEKDAYS)[number]),
  };
}

/** Diferença (ms) entre a hora de parede em SP e o UTC naquele instante (ex.: −3 h). */
function offsetMs(date: Date): number {
  const w = wallTimeSP(date);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Dia em SP no formato `YYYY-MM-DD`. */
export function daySP(date: Date): string {
  const w = wallTimeSP(date);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** Dia da semana em SP (0 = domingo … 6 = sábado). */
export function weekdaySP(date: Date): number {
  return wallTimeSP(date).weekday;
}

/** Minutos desde a meia-noite em SP (0 … 1439). */
export function minutesOfDaySP(date: Date): number {
  const w = wallTimeSP(date);
  return w.hour * 60 + w.minute;
}

/** Último milissegundo do dia de SP que contém `date`, como instante UTC. */
export function endOfDaySP(date: Date): Date {
  const w = wallTimeSP(date);
  const wallEnd = Date.UTC(w.year, w.month - 1, w.day, 23, 59, 59, 999);
  // Usa o offset vigente no fim do dia (não no instante de entrada), para dias com troca de horário.
  const guess = wallEnd - offsetMs(date);
  return new Date(wallEnd - offsetMs(new Date(guess)));
}

/** Instante UTC da hora de parede `minutes` (desde 00:00) no dia `day` (`YYYY-MM-DD`) de SP. */
export function instantSP(day: string, minutes: number): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
  // Duas passadas: a primeira usa o offset do palpite; a segunda corrige em dia de troca de horário.
  const guess = wall - offsetMs(new Date(wall));
  return new Date(wall - offsetMs(new Date(guess)));
}
