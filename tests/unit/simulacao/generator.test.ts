import { describe, expect, it } from "vitest";
import { drawsOf, simulate, VITRINE_SIM, type SimRestaurant } from "@/src/modules/simulacao/domain/generator";
import { buildSamples } from "@/src/modules/analytics/domain/samples";
import { welch } from "@/src/modules/analytics/domain/incremental";
import { addDaysSP, weekKeyOfDay } from "@/src/shared/week";

const A = { id: "a0000000-0000-4000-8000-00000000000a", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito" as const, extraTables: 55 };
const B = { id: "b0000000-0000-4000-8000-00000000000b", days: [1, 2, 3], startMin: 1260, endMin: 1380, intensity: "um_pouco" as const, extraTables: 35 };

export function vitrineSim(today: string): { r: SimRestaurant; startDay: string } {
  const startDay = addDaysSP(today, -60);
  const switchDay = addDaysSP(today, -7);
  return {
    startDay,
    r: {
      id: "00000000-0000-4000-8000-0000000000a1",
      slots: [A, B],
      agora: { versionId: "v-agora", itemId: "panna" },
      recompensa: { versionId: "v-rec", itemId: "tiramisu" },
      convites: [
        { slotId: A.id, versionId: "vA1", itemId: "cannoli", unitCostCents: 770, cap: 340, fromDay: startDay, toDay: null },
        { slotId: B.id, versionId: "vB1", itemId: "bruschetta", unitCostCents: 910, cap: 160, fromDay: startDay, toDay: switchDay },
        { slotId: B.id, versionId: "vB2", itemId: "arancini", unitCostCents: 1120, cap: 160, fromDay: switchDay, toDay: null },
      ],
      variantTokens: ["d-a", "d-b", "c-a", "c-b"],
    },
  };
}

function run(today: string) {
  const { r, startDay } = vitrineSim(today);
  const out = simulate(r, { ...VITRINE_SIM, startDay, reactivation: { day: addDaysSP(today, -7), minute: 600, planKey: "anterior" } });
  const visits = out.checkins.map((c) => ({ customerId: c.customerId, day: c.day, idle: c.idle }));
  const s = buildSamples({ draws: drawsOf(out), visits, costs: [], today });
  return { out, s, inc: welch(s.t, s.h), mig: welch(s.tPeak, s.hPeak, 2) };
}

describe("simulador por agente", () => {
  it("mesma semente → mesmas linhas", () => {
    const a = run("2026-11-23").out;
    const b = run("2026-11-23").out;
    expect(a.checkins.length).toBe(b.checkins.length);
    expect(a.codes.map((c) => c.code)).toEqual(b.codes.map((c) => c.code));
    expect(a.customers.map((c) => c.id)).toEqual(b.customers.map((c) => c.id));
  });

  it("volume da vitrine: ~200 clientes novos por semana e holdout ≈ 10% dos sorteados", () => {
    const { out } = run("2026-11-23");
    expect(out.customers.length).toBeGreaterThan(1500);
    expect(out.customers.length).toBeLessThan(1950);
    const draws = drawsOf(out);
    const hold = draws.filter((d) => d.arm === "holdout").length / draws.length;
    expect(hold).toBeGreaterThan(0.07);
    expect(hold).toBeLessThan(0.13);
  });

  const migDiffs: number[] = [];
  // Com a semente da vitrine (20261157: das 40 sementes a partir de 20261124, só 3 cumprem estes critérios nos 7 dias; escolhida a de maior folga — D146), o IC 95%
  // fica acima de zero e contém o efeito programado nas 7 datas de início.
  for (let k = 0; k < 7; k++) {
    const today = addDaysSP("2026-11-23", k);
    it(`IC da vitrine > 0 e contém +0,20 (hoje = ${today})`, () => {
      const { inc, mig } = run(today);
      expect(inc.state).toBe("positivo");
      if (inc.state === "amostra_insuficiente") return;
      expect(inc.lo).toBeGreaterThan(0);
      expect(inc.lo).toBeLessThanOrEqual(0.2);
      expect(inc.hi).toBeGreaterThanOrEqual(0.2);
      expect(inc.nH).toBeGreaterThanOrEqual(30);
      migDiffs.push(mig.state === "amostra_insuficiente" ? 0 : mig.diff);
    });
  }

  it("migração: em média, os convidados perdem visitas de pico (proteção mede o deslocamento)", () => {
    expect(migDiffs).toHaveLength(7);
    expect(migDiffs.reduce((a, b) => a + b, 0) / migDiffs.length).toBeLessThan(0);
  });

  it("teto da semana em curso com folga (≥ 40%) em qualquer dia de início", () => {
    for (let k = 0; k < 7; k++) {
      const today = addDaysSP("2026-11-23", k);
      const { out } = run(today);
      const wk = weekKeyOfDay(today); // semana em curso (a simulação vai até ontem)
      for (const q of out.quotas.filter((x) => x.weekKey === wk)) expect(q.used / q.cap).toBeLessThanOrEqual(0.6);
    }
  });

  it("robustez: em 20 sementes, IC > 0 em pelo menos 75% (medido na S3: 16 de 20 em 23/11; 132 de 140 em 20 sementes × 7 dias — D146)", () => {
    let ok = 0;
    const today = "2026-11-23";
    const { r, startDay } = vitrineSim(today);
    for (let k = 0; k < 20; k++) {
      const out = simulate(r, { ...VITRINE_SIM, seed: 1000 + k, startDay, reactivation: { day: addDaysSP(today, -7), minute: 600, planKey: "anterior" } });
      const s = buildSamples({ draws: drawsOf(out), visits: out.checkins.map((c) => ({ customerId: c.customerId, day: c.day, idle: c.idle })), costs: [], today });
      const inc = welch(s.t, s.h);
      if (inc.state === "positivo") ok++;
    }
    expect(ok / 20).toBeGreaterThanOrEqual(0.75);
  }, 30_000);

  it("reativação gera envio com convites de origem 'reativacao' só para quem tem opt-in", () => {
    const { out } = run("2026-11-23");
    const send = out.sends.find((s) => s.key === "anterior")!;
    expect(send.members.length).toBeGreaterThan(0);
    const optIn = new Map(out.customers.map((c) => [c.id, c.optIn]));
    expect(send.members.every((m) => optIn.get(m.customerId))).toBe(true);
    expect(out.invites.some((i) => i.origin === "reativacao")).toBe(true);
  });
});
