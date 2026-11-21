import { describe, expect, it } from "vitest";
import type { Incremental } from "@/src/modules/analytics/domain/incremental";
import { slotGoals, valueTopline } from "@/src/modules/analytics/domain/value";
import type { Slot } from "@/src/modules/beneficios/domain/slots";

const early = { usados: 14, custoCents: 12_600 };
const amostra: Incremental = { state: "amostra_insuficiente", nT: 40, nH: 12 };
const inconclusivo: Incremental = { state: "inconclusivo", nT: 300, nH: 40, diff: 0.05, se: 0.1, lo: -0.15, hi: 0.25 };
const positivo: Incremental = { state: "positivo", nT: 212, nH: 35, diff: 0.2, se: 0.05, lo: 0.1, hi: 0.3 };
const negativo: Incremental = { state: "negativo", nT: 212, nH: 35, diff: -0.2, se: 0.05, lo: -0.3, hi: -0.1 };

describe("valueTopline (S5.1, D179)", () => {
  it("resultado positivo com margem → camada causal, com centavos arredondados", () => {
    expect(valueTopline({ inc: positivo, margin: { cents: 184_012.4, lo: 90_000.6, hi: 270_000 }, early, ticketCents: 7_000, marginPct: 35 })).toEqual({
      kind: "causal_positivo",
      cents: 184_012,
      lo: 90_001,
      hi: 270_000,
      nT: 212,
    });
  });

  it("resultado negativo → causal_negativo", () => {
    expect(valueTopline({ inc: negativo, margin: { cents: -31_000, lo: -50_000, hi: -12_000 }, early, ticketCents: 7_000, marginPct: 35 })).toMatchObject({ kind: "causal_negativo", cents: -31_000 });
  });

  it("amostra insuficiente → antecipada: consumo = usados × ticket; margem = consumo × margem%; faltam por grupo", () => {
    expect(valueTopline({ inc: amostra, margin: null, early, ticketCents: 7_000, marginPct: 35 })).toEqual({
      kind: "antecipado",
      motivo: "amostra",
      usados: 14,
      consumoCents: 98_000,
      margemCents: 34_300,
      custoCents: 12_600,
      faltamControle: 18,
      faltamConvidados: 0,
    });
  });

  it("faltam convidados quando são eles que estão abaixo de 30", () => {
    const r = valueTopline({ inc: { state: "amostra_insuficiente", nT: 4, nH: 0 }, margin: null, early: { usados: 0, custoCents: 0 }, ticketCents: 7_000, marginPct: 35 });
    expect(r).toMatchObject({ kind: "antecipado", faltamControle: 30, faltamConvidados: 26, usados: 0, consumoCents: 0 });
  });

  it("inconclusivo → antecipada com motivo 'inconclusivo' e nada faltando", () => {
    expect(valueTopline({ inc: inconclusivo, margin: { cents: 1, lo: -1, hi: 2 }, early, ticketCents: 7_000, marginPct: 35 })).toMatchObject({
      kind: "antecipado",
      motivo: "inconclusivo",
      faltamControle: 0,
      faltamConvidados: 0,
    });
  });

  it("sem ticket ou margem declarados → sem_valores (só contagens)", () => {
    expect(valueTopline({ inc: amostra, margin: null, early, ticketCents: null, marginPct: 35 })).toEqual({
      kind: "sem_valores",
      motivo: "amostra",
      usados: 14,
      custoCents: 12_600,
      faltamControle: 18,
      faltamConvidados: 0,
    });
    expect(valueTopline({ inc: positivo, margin: null, early, ticketCents: 7_000, marginPct: null })).toMatchObject({ kind: "sem_valores", motivo: "causal" });
  });
});

describe("slotGoals (S5.1, metas por faixa)", () => {
  const a: Slot = { id: "a", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 8 };
  const b: Slot = { id: "b", days: [1], startMin: 720, endMin: 840, intensity: "um_pouco", extraTables: 3 };

  it("usados pela semana de validação; emitidos e teto pela quota; teto reserva quando a quota não existe", () => {
    const r = slotGoals([a, b], new Map([["a", 3]]), new Map([["a", { used: 12, cap: 32 }]]), new Map([["b", 12]]));
    expect(r).toEqual([
      { slotId: "a", days: [2, 3, 4], startMin: 900, endMin: 1080, metaMesas: 8, usados: 3, emitidos: 12, teto: 32 },
      { slotId: "b", days: [1], startMin: 720, endMin: 840, metaMesas: 3, usados: 0, emitidos: 0, teto: 12 },
    ]);
  });

  it("sem quota nem reserva → teto nulo", () => {
    expect(slotGoals([b], new Map(), new Map(), new Map())[0]!.teto).toBeNull();
  });
});
