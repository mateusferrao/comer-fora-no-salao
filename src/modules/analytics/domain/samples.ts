/**
 * Amostras do incremento por intenção de tratar (D216, D217): unidade = cliente sorteado; janela W = os 14 dias
 * APÓS o dia do sorteio (1º convite real ou fantasma); só janelas fechadas. Visitas = check-ins (limitação declarada).
 */
import type { Arm } from "@/src/modules/salao/domain/experiment";
import { addDaysSP } from "@/src/shared/week";

export const WINDOW_DAYS = 14;

export type Samples = {
  t: number[];
  h: number[];
  tIdle: number[];
  hIdle: number[];
  tPeak: number[];
  hPeak: number[];
  costConvCents: number;
  costHoldCents: number;
};

export function buildSamples(p: {
  draws: ReadonlyArray<{ customerId: string; arm: Arm; drawDay: string }>;
  visits: ReadonlyArray<{ customerId: string; day: string; idle: boolean }>;
  costs: ReadonlyArray<{ customerId: string; day: string; cents: number }>;
  today: string;
}): Samples {
  const visitsBy = new Map<string, Array<{ day: string; idle: boolean }>>();
  for (const v of p.visits) visitsBy.set(v.customerId, [...(visitsBy.get(v.customerId) ?? []), v]);
  const costBy = new Map<string, Array<{ day: string; cents: number }>>();
  for (const c of p.costs) costBy.set(c.customerId, [...(costBy.get(c.customerId) ?? []), c]);
  const s: Samples = { t: [], h: [], tIdle: [], hIdle: [], tPeak: [], hPeak: [], costConvCents: 0, costHoldCents: 0 };
  for (const d of p.draws) {
    const end = addDaysSP(d.drawDay, WINDOW_DAYS);
    if (end >= p.today) continue; // janela ainda aberta
    const inW = (day: string) => day > d.drawDay && day <= end;
    const vs = (visitsBy.get(d.customerId) ?? []).filter((v) => inW(v.day));
    const idle = vs.filter((v) => v.idle).length;
    const cost = (costBy.get(d.customerId) ?? []).filter((c) => inW(c.day)).reduce((x, c) => x + c.cents, 0);
    if (d.arm === "convidavel") {
      s.t.push(vs.length);
      s.tIdle.push(idle);
      s.tPeak.push(vs.length - idle);
      s.costConvCents += cost;
    } else {
      s.h.push(vs.length);
      s.hIdle.push(idle);
      s.hPeak.push(vs.length - idle);
      s.costHoldCents += cost;
    }
  }
  return s;
}
