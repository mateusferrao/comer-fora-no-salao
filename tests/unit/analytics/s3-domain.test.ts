import { describe, expect, it } from "vitest";
import { funnelSteps, periodRange } from "@/src/modules/analytics/domain/funnel";
import { turnHeatmap } from "@/src/modules/analytics/domain/insights";
import { verdict, verdictInputs } from "@/src/modules/analytics/domain/verdict";
import { addDaysSP } from "@/src/shared/week";
import { segmentOf } from "@/src/modules/analytics/domain/segments";
import { abStatus, AB_MIN_SAMPLE } from "@/src/modules/analytics/domain/ab";
import { recalibratedCap } from "@/src/modules/onboarding/domain/candidates";
import { reactivationPlan, type ReactivationCustomer } from "@/src/modules/planos/domain/reactivation";
import { assignArm } from "@/src/modules/salao/domain/experiment";
import type { Slot } from "@/src/modules/beneficios/domain/slots";

describe("funil (espec. 3.6; revisão do plano S3: só convites da mesa, % só entre subconjuntos)", () => {
  const c = { scans: 200, checkins: 100, newContacts: 60, invitesTable: 40, invitesReactivation: 12, returnsWithInvite: 10, inviteCodesValidated: 8, firstVisitValidated: 50 };
  it("6 etapas na ordem, convites de reativação à parte", () => {
    const f = funnelSteps(c);
    expect(f.steps.map((s) => s.key)).toEqual(["leituras", "checkins", "contato", "convites", "voltaram", "validados"]);
    expect(f.steps.map((s) => s.value)).toEqual([200, 100, 60, 40, 10, 8]);
    expect(f.side).toEqual({ invitesReactivation: 12, firstVisitValidated: 50 });
  });
  it("% só onde a etapa é subconjunto da anterior", () => {
    const f = funnelSteps(c);
    expect(f.steps.map((s) => s.pctOfPrev)).toEqual([null, 50, 60, null, null, 80]);
  });
  it("leitura → check-in acima de 100% não mostra %", () => {
    expect(funnelSteps({ ...c, scans: 50 }).steps[1]!.pctOfPrev).toBeNull();
  });
  it("divisão por zero → null", () => {
    expect(funnelSteps({ ...c, returnsWithInvite: 0, inviteCodesValidated: 0 }).steps[5]!.pctOfPrev).toBeNull();
  });
  it("períodos em dias SP: hoje, últ. 7 e 30 dias", () => {
    expect(periodRange("hoje", "2026-11-23")).toEqual({ from: "2026-11-23", to: "2026-11-23" });
    expect(periodRange("7d", "2026-11-23")).toEqual({ from: "2026-11-17", to: "2026-11-23" });
    expect(periodRange("30d", "2026-11-23")).toEqual({ from: "2026-10-25", to: "2026-11-23" });
  });
});

describe("mapa dia × turno (insight 1)", () => {
  const slots: Slot[] = [{ id: "A", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 2 }];
  const opening = [{ days: [0, 1, 2, 3, 4, 5, 6], startMin: 660, endMin: 1380 }];
  // 2026-11-16 é segunda (1). Muitos check-ins no almoço; a tarde de terça vazia (declarada) e a noite de segunda vazia (não declarada).
  const ck: Array<{ day: string; turn: "almoco" | "tarde" | "noite" }> = [];
  for (const day of ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]) {
    for (let i = 0; i < 10; i++) ck.push({ day, turn: "almoco" });
    for (let i = 0; i < 8; i++) ck.push({ day, turn: "tarde" });
    if (day !== "2026-11-16") for (let i = 0; i < 9; i++) ck.push({ day, turn: "noite" });
  }
  it("conta por dia da semana e turno e marca as faixas declaradas", () => {
    const h = turnHeatmap(ck, slots, opening);
    const tueTarde = h.cells.find((x) => x.weekday === 2 && x.turn === "tarde")!;
    expect(tueTarde).toMatchObject({ count: 8, declared: true });
    expect(h.cells.find((x) => x.weekday === 1 && x.turn === "noite")).toMatchObject({ count: 0, declared: false, open: true });
  });
  it("turno com poucos check-ins e não declarado vira alerta; declarado não", () => {
    const h = turnHeatmap(ck, slots, opening);
    expect(h.lowUndeclared.map((x) => `${x.weekday}:${x.turn}`)).toEqual(["1:noite"]);
  });
});

describe("veredito por oferta (D220; revisão do plano S3: só uso e amostra)", () => {
  it("menos de 10 convites com 7 dias → cedo demais", () => {
    expect(verdict({ issued7d: 9, used7d: 9 })).toBe("cedo_demais");
  });
  it("uso ≥ 15% → manter; abaixo → trocar", () => {
    expect(verdict({ issued7d: 20, used7d: 3 })).toBe("manter");
    expect(verdict({ issued7d: 20, used7d: 2 })).toBe("trocar");
    expect(verdict({ issued7d: 10, used7d: 2 })).toBe("manter");
  });
});

describe("entradas do veredito", () => {
  it("só convites com ≥ 7 dias (janela de 30) e uso em até 7 dias da emissão", () => {
    const inv = [
      { issuedDay: "2026-11-16", usedDay: "2026-11-18" }, // 7 dias antes de 23/11: entra, usado
      { issuedDay: "2026-11-17", usedDay: null }, // 6 dias: fora
      { issuedDay: "2026-11-01", usedDay: "2026-11-09" }, // usado no 8º dia: não conta como usado
      { issuedDay: "2026-10-17", usedDay: null }, // 37 dias: entra
      { issuedDay: "2026-10-16", usedDay: null }, // 38 dias: fora
    ];
    expect(verdictInputs(inv, "2026-11-23", addDaysSP)).toEqual({ issued7d: 3, used7d: 1 });
  });
});

describe("teto recalibrado (espec. 3.3)", () => {
  it("ceil(mesas / clamp(uso, 0,1, 1)); sem uso → mesas × 4", () => {
    expect(recalibratedCap(2, 0.25)).toBe(8);
    expect(recalibratedCap(2, 0.05)).toBe(20);
    expect(recalibratedCap(2, null)).toBe(8);
    expect(recalibratedCap(3, 1.5)).toBe(3);
  });
});

describe("segmentos (espec. 3.6)", () => {
  const today = "2026-11-23";
  const base = { visits: 1, lastDay: "2026-11-09", stamps: 1, visits30d: 1, hasActiveInvite: false };
  it("1 visita e sumiu: há ≥ 14 dias", () => {
    expect(segmentOf(base, today)).toContain("sumiu");
    expect(segmentOf({ ...base, lastDay: "2026-11-10" }, today)).not.toContain("sumiu");
    expect(segmentOf({ ...base, visits: 2 }, today)).not.toContain("sumiu");
  });
  it("perto da recompensa: 4–5 selos", () => {
    expect(segmentOf({ ...base, stamps: 4 }, today)).toContain("perto");
    expect(segmentOf({ ...base, stamps: 5 }, today)).toContain("perto");
    expect(segmentOf({ ...base, stamps: 6 }, today)).not.toContain("perto");
    expect(segmentOf({ ...base, stamps: 3 }, today)).not.toContain("perto");
  });
  it("frequentes: ≥ 3 check-ins em 30 dias; convite ativo", () => {
    expect(segmentOf({ ...base, visits: 3, visits30d: 3 }, today)).toContain("frequente");
    expect(segmentOf({ ...base, visits30d: 2 }, today)).not.toContain("frequente");
    expect(segmentOf({ ...base, hasActiveInvite: true }, today)).toContain("convite_ativo");
  });
});

describe("A/B (D34)", () => {
  it("amostra mínima de 356 por versão", () => {
    expect(AB_MIN_SAMPLE).toBe(356);
    expect(abStatus({ scans: 355, checkins: 100 }, { scans: 400, checkins: 100 })).toEqual({ state: "faltam", missing: 1 });
  });
  it("com amostra: vencedora só com diferença significativa", () => {
    expect(abStatus({ scans: 400, checkins: 120 }, { scans: 400, checkins: 160 })).toMatchObject({ state: "vencedora", winner: "B" });
    expect(abStatus({ scans: 400, checkins: 120 }, { scans: 400, checkins: 125 })).toEqual({ state: "sem_diferenca" });
  });
});

describe("reativação (função pura única — intenção de tratar, D142, D216)", () => {
  const R = "11111111-1111-4111-8111-111111111111";
  const slot: Slot = { id: "S", days: [0, 1, 2, 3, 4, 5, 6], startMin: 0, endMin: 1440, intensity: "muito", extraTables: 2 };
  const at = new Date("2026-11-23T13:00:00Z");
  const mk = (i: number, extra: Partial<ReactivationCustomer> = {}): ReactivationCustomer => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    arm: null,
    optIn: true,
    segments: ["sumiu"],
    hasActiveInvite: false,
    lastDay: `2026-10-${String(10 + (i % 15)).padStart(2, "0")}`,
    ...extra,
  });
  it("cota = 50% do teto livre; convidáveis e holdout param juntos quando acaba", () => {
    const cs = Array.from({ length: 20 }, (_, i) => mk(i));
    const out = reactivationPlan(cs, [slot], { S: 6 }, { sharePct: 50, restaurantId: R }, at);
    const real = out.filter((o) => o.decision.kind === "real");
    expect(real).toHaveLength(3);
    // depois da 3ª vaga real, ninguém mais entra (nem holdout)
    const order = [...cs].sort((a, b) => (a.lastDay! < b.lastDay! ? -1 : a.lastDay! > b.lastDay! ? 1 : a.id < b.id ? -1 : 1));
    const lastIdx = Math.max(...out.map((o) => order.findIndex((c) => c.id === o.customerId)));
    const thirdReal = order.findIndex((c) => c.id === real[2]!.customerId);
    expect(lastIdx).toBe(thirdReal);
    for (const o of out) {
      expect(o.decision.arm).toBe(assignArm(o.customerId, R));
      expect(o.decision.kind).toBe(o.decision.arm === "holdout" ? "fantasma" : "real");
    }
  });
  it("frequentes, sem opt-in, com convite ativo e fora dos segmentos ficam fora", () => {
    const cs = [
      mk(1, { segments: ["sumiu", "frequente"] }),
      mk(2, { optIn: false }),
      mk(3, { hasActiveInvite: true }),
      mk(4, { segments: ["convite_ativo"] }),
      mk(5, { segments: ["perto"] }),
    ];
    const out = reactivationPlan(cs, [slot], { S: 100 }, { sharePct: 50, restaurantId: R }, at);
    expect(out.map((o) => o.customerId)).toEqual([cs[4]!.id]);
  });
  it("ordem determinística (última visita, id) e grupo já gravado respeitado", () => {
    const cs = [mk(7, { arm: "holdout" }), mk(6)];
    const a = reactivationPlan(cs, [slot], { S: 100 }, { sharePct: 50, restaurantId: R }, at);
    const b = reactivationPlan([...cs].reverse(), [slot], { S: 100 }, { sharePct: 50, restaurantId: R }, at);
    expect(a).toEqual(b);
    expect(a.find((o) => o.customerId === cs[0]!.id)!.decision.kind).toBe("fantasma");
  });
  it("teto livre 1 → cota 0 (ninguém)", () => {
    expect(reactivationPlan([mk(1)], [slot], { S: 1 }, { sharePct: 50, restaurantId: R }, at)).toEqual([]);
  });
});
