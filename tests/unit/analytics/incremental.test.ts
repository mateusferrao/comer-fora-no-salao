import { describe, expect, it } from "vitest";
import { cohorts, marginIncrement, welch } from "@/src/modules/analytics/domain/incremental";
import { buildSamples } from "@/src/modules/analytics/domain/samples";

describe("welch (aproximação normal, IC 95%)", () => {
  it("valores calculados à mão", () => {
    // t: média 2,5, var 1,6667; h: média 1, var 1 → diff 1,5; se = √(1,6667/4 + 1/3) = √0,75 = 0,8660
    const r = welch([1, 2, 3, 4], [0, 1, 2], 2);
    if (r.state === "amostra_insuficiente") throw new Error("esperava números");
    expect(r.diff).toBeCloseTo(1.5, 10);
    expect(r.se).toBeCloseTo(Math.sqrt(0.75), 10);
    expect(r.lo).toBeCloseTo(1.5 - 1.96 * Math.sqrt(0.75), 10);
    expect(r.hi).toBeCloseTo(1.5 + 1.96 * Math.sqrt(0.75), 10);
    expect(r.state).toBe("inconclusivo");
  });
  it("positivo e negativo", () => {
    expect(welch([3, 4, 5], [0, 1, 2], 2)).toMatchObject({ state: "positivo", diff: 3 });
    expect(welch([0, 1, 2], [3, 4, 5], 2)).toMatchObject({ state: "negativo", diff: -3 });
  });
  it("n < 30 em algum grupo → amostra insuficiente (sem números)", () => {
    const t = Array(100).fill(1);
    const h = Array(29).fill(0);
    expect(welch(t, h)).toEqual({ state: "amostra_insuficiente", nT: 100, nH: 29 });
  });
  it("se = 0 → inconclusivo", () => {
    expect(welch(Array(30).fill(1), Array(30).fill(1)).state).toBe("inconclusivo");
  });
});

describe("margem incremental", () => {
  it("diff · nC · ticket · margem − Δcusto; o 'agora' se cancela (não entra)", () => {
    const inc = { state: "positivo" as const, nT: 100, nH: 10, diff: 0.2, se: 0.05, lo: 0.1, hi: 0.3 };
    // ganho = 0,2 · 100 · 8500 · 0,65 = 110500; Δcusto = 40000 − 0 · 100/10 = 40000 → 70500
    const m = marginIncrement({ inc, ticketCents: 8500, marginPct: 65, costConvCents: 40_000, costHoldCents: 0 })!;
    expect(m.cents).toBeCloseTo(70_500, 6);
    expect(m.lo).toBeCloseTo(0.1 * 100 * 8500 * 0.65 - 40_000, 6);
    expect(m.hi).toBeCloseTo(0.3 * 100 * 8500 * 0.65 - 40_000, 6);
    const mh = marginIncrement({ inc, ticketCents: 8500, marginPct: 65, costConvCents: 40_000, costHoldCents: 1_000 })!;
    expect(mh.cents).toBeCloseTo(70_500 + 1_000 * 10, 6);
  });
  it("sem ticket ou margem → null (painel mostra só visitas)", () => {
    const inc = { state: "positivo" as const, nT: 100, nH: 40, diff: 0.2, se: 0.05, lo: 0.1, hi: 0.3 };
    expect(marginIncrement({ inc, ticketCents: null, marginPct: 65, costConvCents: 0, costHoldCents: 0 })).toBeNull();
    expect(marginIncrement({ inc: { state: "amostra_insuficiente", nT: 1, nH: 1 }, ticketCents: 1, marginPct: 1, costConvCents: 0, costHoldCents: 0 })).toBeNull();
  });
});

describe("amostras por janela de 14 dias (intenção de tratar)", () => {
  it("só janelas fechadas; o dia do sorteio não conta; separa faixa vazia e pico", () => {
    const s = buildSamples({
      draws: [
        { customerId: "a", arm: "convidavel", drawDay: "2026-11-01" },
        { customerId: "b", arm: "holdout", drawDay: "2026-11-01" },
        { customerId: "c", arm: "convidavel", drawDay: "2026-11-10" }, // janela até 24/11: aberta em 20/11
      ],
      visits: [
        { customerId: "a", day: "2026-11-01", idle: false },
        { customerId: "a", day: "2026-11-03", idle: true },
        { customerId: "a", day: "2026-11-15", idle: false },
        { customerId: "a", day: "2026-11-16", idle: false }, // fora (dia 15)
        { customerId: "b", day: "2026-11-02", idle: false },
      ],
      costs: [{ customerId: "a", day: "2026-11-03", cents: 770 }],
      today: "2026-11-20",
    });
    expect(s.t).toEqual([2]);
    expect(s.h).toEqual([1]);
    expect(s.tIdle).toEqual([1]);
    expect(s.tPeak).toEqual([1]);
    expect(s.hPeak).toEqual([1]);
    expect(s.costConvCents).toBe(770);
  });
});

describe("coortes de convites", () => {
  it("% usados por semana ISO de emissão; janela aberta = em aberto", () => {
    const r = cohorts(
      [
        { issuedDay: "2026-11-02", usedDay: "2026-11-05" },
        { issuedDay: "2026-11-03", usedDay: null },
        { issuedDay: "2026-11-04", usedDay: "2026-11-20" }, // usado depois de 7 dias: não conta
        { issuedDay: "2026-11-16", usedDay: null },
      ],
      "2026-11-20",
      7,
    );
    expect(r).toEqual([
      { weekKey: "2026-W45", issued: 3, used: 1, pct: 1 / 3, open: false },
      { weekKey: "2026-W47", issued: 1, used: 0, pct: 0, open: true },
    ]);
  });
});
