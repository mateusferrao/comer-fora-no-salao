import { describe, expect, it } from "vitest";
import { applyDecision, decideCheckin, type CheckinInput, type CustomerState } from "@/src/modules/salao/domain/decide-checkin";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { STAMP_CARD_DEFAULTS } from "@/src/modules/beneficios/domain/stamp-card";
import { instantSP } from "@/src/shared/week";

const A: Slot = { id: "A", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 55 };
const NEW: CustomerState = { lastCheckinDay: null, firstVisitCodeIssued: false, card: null, activeInvite: null, arm: null };

function input(at: Date, customer: CustomerState, p: Partial<CheckinInput> = {}): CheckinInput {
  return {
    at,
    customerId: "c-conv",
    restaurantId: "r1",
    customer,
    rule: { active: true, slots: [A], remaining: { A: 5 } },
    stampConfig: STAMP_CARD_DEFAULTS,
    ...p,
  };
}

// segunda 23/11 13h SP (fora da faixa A)
const seg13 = instantSP("2026-11-23", 13 * 60);

describe("decideCheckin", () => {
  it("1ª visita: código de 1ª visita + selo 1/6 + convite real (2º card)", () => {
    const d = decideCheckin(input(seg13, { ...NEW, arm: "convidavel" }));
    expect(d.outcome).toBe("primeira_visita");
    expect(d.codes).toEqual(["primeira_visita"]);
    expect(d.stamp).toMatchObject({ stamped: true, stamps: 1, required: 6, completed: false });
    expect(d.invite).toMatchObject({ kind: "real", slotId: "A" });
    expect(d.reminder).toBeNull();
    expect(d.turn).toBe("almoco");
    expect(d.day).toBe("2026-11-23");
  });
  it("holdout: igual à 1ª visita, com fantasma e sem nada visível", () => {
    const d = decideCheckin(input(seg13, { ...NEW, arm: "holdout" }));
    expect(d.outcome).toBe("primeira_visita");
    expect(d.invite).toMatchObject({ kind: "fantasma" });
    expect(d.reminder).toBeNull();
  });
  it("teto esgotado: só o agora e o selo", () => {
    const d = decideCheckin(input(seg13, NEW, { rule: { active: true, slots: [A], remaining: { A: 0 } } }));
    expect(d.invite).toEqual({ kind: "teto_esgotado" });
    expect(d.codes).toEqual(["primeira_visita"]);
  });
  it("já fez check-in hoje: nada muda", () => {
    const first = decideCheckin(input(seg13, { ...NEW, arm: "convidavel" }));
    const state = applyDecision({ ...NEW, arm: "convidavel" }, first);
    const again = decideCheckin(input(instantSP("2026-11-23", 20 * 60), state));
    expect(again.outcome).toBe("ja_fez_checkin_hoje");
    expect(again.codes).toEqual([]);
    expect(again.stamp).toBeNull();
    expect(again.invite).toBeNull();
  });

  const afterFirst = () => {
    const first = decideCheckin(input(seg13, { ...NEW, arm: "convidavel" }));
    return applyDecision({ ...NEW, arm: "convidavel" }, first);
  };

  it("volta dentro da faixa em outro dia → código do convite", () => {
    const ter1610 = instantSP("2026-11-24", 16 * 60 + 10);
    const d = decideCheckin(input(ter1610, afterFirst()));
    expect(d.outcome).toBe("volta_com_convite");
    expect(d.codes).toEqual(["convite"]);
    expect(d.stamp).toMatchObject({ stamps: 2 });
    expect(d.invite).toBeNull();
    expect(d.firstVisitAlreadyUsed).toBe(true);
  });
  it("S3 (D141): convite liberado 'só no teste' vale fora da faixa naquele dia; no dia seguinte volta a ser lembrete", () => {
    const back = { lastCheckinDay: "2026-11-22", firstVisitCodeIssued: true, card: null, arm: "convidavel" as const };
    const inv = { slot: A, arm: "convidavel" as const, status: "ativo" as const, issuedDay: "2026-11-22", expiresAt: new Date("2026-12-23T03:00:00Z"), anyTimeDay: "2026-11-23" };
    const d = decideCheckin(input(seg13, { ...back, activeInvite: inv }));
    expect(d.outcome).toBe("volta_com_convite");
    expect(d.codes).toContain("convite");
    const next = decideCheckin(input(instantSP("2026-11-24", 13 * 60), { ...back, lastCheckinDay: "2026-11-23", activeInvite: inv }));
    expect(next.outcome).toBe("volta_lembrete");
  });
  it("volta fora da faixa → lembrete do convite ativo", () => {
    const ter20 = instantSP("2026-11-24", 20 * 60);
    const d = decideCheckin(input(ter20, afterFirst()));
    expect(d.outcome).toBe("volta_lembrete");
    expect(d.codes).toEqual([]);
    expect(d.reminder).toMatchObject({ slot: { id: "A" } });
  });
  it("convite emitido na faixa: no mesmo dia não gera código (o 2º check-in do dia é barrado)", () => {
    const ter16 = instantSP("2026-11-24", 16 * 60);
    const first = decideCheckin(input(ter16, { ...NEW, arm: "convidavel" }));
    expect(first.codes).toEqual(["primeira_visita"]);
    const state = applyDecision({ ...NEW, arm: "convidavel" }, first);
    expect(decideCheckin(input(instantSP("2026-11-24", 17 * 60), state)).outcome).toBe("ja_fez_checkin_hoje");
    expect(decideCheckin(input(instantSP("2026-11-25", 16 * 60), state)).codes).toEqual(["convite"]);
  });
  it("holdout com fantasma: volta sem código de convite e sem lembrete", () => {
    const first = decideCheckin(input(seg13, { ...NEW, arm: "holdout" }));
    const state = applyDecision({ ...NEW, arm: "holdout" }, first);
    const d = decideCheckin(input(instantSP("2026-11-24", 16 * 60), state));
    expect(d.outcome).toBe("volta");
    expect(d.codes).toEqual([]);
    expect(d.reminder).toBeNull();
    expect(d.invite).toBeNull(); // fantasma ativo conta como convite ativo
  });
  it("convite vencido não conta: novo convite pode nascer", () => {
    const state = afterFirst();
    const depois = instantSP("2026-12-24", 13 * 60); // 31 dias depois
    const expired = { ...state, activeInvite: null };
    const d = decideCheckin(input(depois, expired));
    expect(d.outcome).toBe("volta");
    expect(d.invite).toMatchObject({ kind: "real" });
  });
  it("6º selo: recompensa com código, somada ao resultado", () => {
    let state: CustomerState = { ...NEW, arm: "convidavel" };
    const days = ["2026-11-23", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30"];
    let last;
    for (const day of days) {
      last = decideCheckin(input(instantSP(day, 13 * 60), state));
      state = applyDecision(state, last);
    }
    expect(last!.stamp).toMatchObject({ stamps: 6, completed: true });
    expect(last!.codes).toContain("recompensa");
  });
  it("applyDecision grava o grupo sorteado e o convite congelado", () => {
    const d = decideCheckin(input(seg13, NEW));
    const s = applyDecision(NEW, d);
    expect(s.arm).not.toBeNull();
    expect(s.lastCheckinDay).toBe("2026-11-23");
    expect(s.firstVisitCodeIssued).toBe(true);
    expect(s.activeInvite).toMatchObject({ slot: { id: "A", days: [2, 3, 4] }, issuedDay: "2026-11-23" });
    expect(s.activeInvite!.status).toBe(s.arm === "holdout" ? "suprimido" : "ativo");
  });
});
