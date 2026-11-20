/**
 * Insight 1 (espec. 3.7.1): check-ins por dia da semana × turno contra o movimento declarado.
 * Nunca chamar de "ocupação": check-in mede só quem leu o QR.
 */
import type { OpeningHours, Slot, Turn } from "@/src/modules/beneficios/domain/slots";
import { weekdayOfDay } from "@/src/shared/week";

export const HEATMAP_TURNS = ["almoco", "tarde", "noite"] as const satisfies readonly Turn[];
export type HeatTurn = (typeof HEATMAP_TURNS)[number];
const RANGE: Record<HeatTurn, [number, number]> = { almoco: [660, 900], tarde: [900, 1080], noite: [1080, 1440] };
/** Abaixo de 25% da mediana das células abertas = "poucos check-ins" [C]. */
export const LOW_FRACTION = 0.25;

export type HeatCell = { weekday: number; turn: HeatTurn; count: number; declared: boolean; open: boolean };

const overlaps = (a: [number, number], s: number, e: number) => s < a[1] && e > a[0];

export function turnHeatmap(checkins: ReadonlyArray<{ day: string; turn: Turn }>, slots: readonly Pick<Slot, "days" | "startMin" | "endMin">[], opening: OpeningHours): { cells: HeatCell[]; lowUndeclared: HeatCell[] } {
  const counts = new Map<string, number>();
  for (const c of checkins) {
    if (!(HEATMAP_TURNS as readonly string[]).includes(c.turn)) continue;
    const k = `${weekdayOfDay(c.day)}:${c.turn}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const cells: HeatCell[] = [];
  for (const weekday of [1, 2, 3, 4, 5, 6, 0]) {
    for (const turn of HEATMAP_TURNS) {
      const r = RANGE[turn];
      cells.push({
        weekday,
        turn,
        count: counts.get(`${weekday}:${turn}`) ?? 0,
        declared: slots.some((s) => s.days.includes(weekday) && overlaps(r, s.startMin, s.endMin)),
        open: opening.some((b) => b.days.includes(weekday) && overlaps(r, b.startMin, b.endMin)),
      });
    }
  }
  const open = cells.filter((c) => c.open).map((c) => c.count).sort((a, b) => a - b);
  const median = open.length ? open[Math.floor(open.length / 2)]! : 0;
  const lowUndeclared = cells
    .filter((c) => c.open && !c.declared && median > 0 && c.count <= LOW_FRACTION * median)
    .sort((a, b) => a.count - b.count)
    .slice(0, 3);
  return { cells, lowUndeclared };
}
