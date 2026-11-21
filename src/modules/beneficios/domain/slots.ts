/**
 * Horários vazios (faixas), horário de funcionamento e turnos — espec. 3.3, D218.
 * Dias: 0 = domingo … 6 = sábado. Minutos desde 00:00 em SP; fim exclusivo; sem cruzar a meia-noite [C].
 */
import { z } from "zod";
import { minutesOfDaySP, weekdaySP } from "@/src/shared/tz";

/** Quanto o horário fica vazio (ajuste de 21/11: 3 níveis — "Mais ou menos" no meio). Só ordena a prioridade e informa a IA. */
export const INTENSITIES = ["muito", "medio", "um_pouco"] as const;
export type Intensity = (typeof INTENSITIES)[number];
export const INTENSITY_LABEL: Record<Intensity, string> = {
  muito: "Muito",
  medio: "Mais ou menos",
  um_pouco: "Pouco",
};
export const INTENSITY_PHRASE: Record<Intensity, string> = {
  muito: "muito vazio",
  medio: "mais ou menos vazio",
  um_pouco: "pouco vazio",
};

export type Slot = { id: string; days: number[]; startMin: number; endMin: number; intensity: Intensity; extraTables: number };

const minutes = z.number().int().min(0).max(1440);
const days = z.array(z.number().int().min(0).max(6));
export const openingBlockSchema = z.object({ days, startMin: minutes, endMin: minutes });
export const openingHoursSchema = z.array(openingBlockSchema);
export type OpeningBlock = z.infer<typeof openingBlockSchema>;
export type OpeningHours = z.infer<typeof openingHoursSchema>;

export const slotSchema = z.object({
  id: z.string().min(1),
  days,
  startMin: minutes,
  endMin: minutes,
  intensity: z.enum(INTENSITIES),
  extraTables: z.number().int().min(0),
});

export type SlotError = "dias_vazios" | "horario_invalido" | "fora_do_funcionamento";

export function validateSlot(slot: Slot, opening: OpeningHours): SlotError[] {
  if (slot.days.length === 0) return ["dias_vazios"];
  if (!(slot.startMin < slot.endMin)) return ["horario_invalido"];
  const fits = slot.days.every((d) =>
    opening.some((b) => b.days.includes(d) && b.startMin <= slot.startMin && slot.endMin <= b.endMin),
  );
  return fits ? [] : ["fora_do_funcionamento"];
}

export function isInSlot(slot: Pick<Slot, "days" | "startMin" | "endMin">, at: Date): boolean {
  if (!slot.days.includes(weekdaySP(at))) return false;
  const m = minutesOfDaySP(at);
  return slot.startMin <= m && m < slot.endMin;
}

/** Prioridade: "muito", depois "medio", depois "um_pouco"; empate pela ordem de entrada (estável). */
export function sortByPriority<T extends Pick<Slot, "intensity">>(
  slots: readonly T[],
): T[] {
  const rank = (s: T) => INTENSITIES.indexOf(s.intensity);
  return slots
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .map((x) => x.s);
}

export const TURNS = ["madrugada", "manha", "almoco", "tarde", "noite"] as const;
export type Turn = (typeof TURNS)[number];

/** Turnos fixos [C]: madrugada 0–6, manhã 6–11, almoço 11–15, tarde 15–18, noite 18–24. */
export function turnOfMinutes(m: number): Turn {
  if (m < 360) return "madrugada";
  if (m < 660) return "manha";
  if (m < 900) return "almoco";
  if (m < 1080) return "tarde";
  return "noite";
}

export function turnOf(at: Date): Turn {
  return turnOfMinutes(minutesOfDaySP(at));
}

const SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function ordered(d: readonly number[]): number[] {
  // Ordem de leitura do app: segunda primeiro, domingo por último.
  return [...new Set(d)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}

export function formatDays(d: readonly number[]): string {
  if (new Set(d).size === 7) return "Todos os dias";
  return ordered(d).map((x) => SHORT[x]).join(", ");
}

/** Rótulo completo para leitores de tela ("terça, quarta e quinta"). */
export function formatDaysLong(d: readonly number[]): string {
  if (new Set(d).size === 7) return "todos os dias";
  const names = ordered(d).map((x) => LONG[x]!);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

function hourLabel(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h${String(mm).padStart(2, "0")}`;
}

export function formatHours(startMin: number, endMin: number): string {
  return `${hourLabel(startMin)}–${hourLabel(endMin)}`;
}

function clock(m: number): string {
  const v = m % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

export function isOpen(opening: OpeningHours, at: Date): boolean {
  const d = weekdaySP(at);
  const m = minutesOfDaySP(at);
  return opening.some((b) => b.days.includes(d) && b.startMin <= m && m < b.endMin);
}

/** "Aberto agora • Fecha às 23:30" [C] / "Loja fechada • Abre qui às 18:00" (print 04). Só informativo (D28). */
export function openingStatus(opening: OpeningHours, at: Date): { open: boolean; label: string } {
  const d = weekdaySP(at);
  const m = minutesOfDaySP(at);
  const current = opening.find((b) => b.days.includes(d) && b.startMin <= m && m < b.endMin);
  if (current) return { open: true, label: `Aberto agora • Fecha às ${clock(current.endMin)}` };
  for (let offset = 0; offset < 8; offset++) {
    const day = (d + offset) % 7;
    const starts = opening
      .filter((b) => b.days.includes(day) && (offset > 0 || b.startMin > m))
      .map((b) => b.startMin)
      .sort((a, b) => a - b);
    if (starts.length > 0) {
      return { open: false, label: `Loja fechada • Abre ${SHORT[day]!.toLowerCase()} às ${clock(starts[0]!)}` };
    }
  }
  return { open: false, label: "Loja fechada" };
}
