import { describe, expect, it } from "vitest";
import { applyCheckin, STAMP_CARD_DEFAULTS } from "@/src/modules/beneficios/domain/stamp-card";
import { instantSP, addDaysSP } from "@/src/shared/week";

const at = (day: string) => instantSP(day, 13 * 60);

describe("cartela", () => {
  it("1º check-in abre a cartela com 1 selo", () => {
    const r = applyCheckin(null, at("2026-11-20"), STAMP_CARD_DEFAULTS);
    expect(r).toMatchObject({ stamped: true, completed: false, renewed: false });
    expect(r.card).toEqual({ startedDay: "2026-11-20", stamps: 1, lastDay: "2026-11-20", completedDay: null });
  });
  it("2 check-ins no mesmo dia → 1 selo", () => {
    const a = applyCheckin(null, at("2026-11-20"), STAMP_CARD_DEFAULTS);
    const b = applyCheckin(a.card, instantSP("2026-11-20", 20 * 60), STAMP_CARD_DEFAULTS);
    expect(b.stamped).toBe(false);
    expect(b.card.stamps).toBe(1);
  });
  it("6º selo completa a cartela; o próximo check-in abre outra", () => {
    let card = applyCheckin(null, at("2026-11-01"), STAMP_CARD_DEFAULTS).card;
    let last;
    for (let i = 1; i <= 5; i++) {
      last = applyCheckin(card, at(addDaysSP("2026-11-01", i)), STAMP_CARD_DEFAULTS);
      card = last.card;
    }
    expect(last).toMatchObject({ completed: true });
    expect(card.stamps).toBe(6);
    expect(card.completedDay).toBe("2026-11-06");
    const next = applyCheckin(card, at("2026-11-07"), STAMP_CARD_DEFAULTS);
    expect(next).toMatchObject({ renewed: true, completed: false });
    expect(next.card).toMatchObject({ startedDay: "2026-11-07", stamps: 1 });
  });
  it("vence 90 dias depois do 1º check-in: dia 90 ainda vale, dia 91 renova", () => {
    const card = applyCheckin(null, at("2026-08-01"), STAMP_CARD_DEFAULTS).card;
    expect(applyCheckin(card, at(addDaysSP("2026-08-01", 90)), STAMP_CARD_DEFAULTS)).toMatchObject({ renewed: false });
    expect(applyCheckin(card, at(addDaysSP("2026-08-01", 90)), STAMP_CARD_DEFAULTS).card.stamps).toBe(2);
    const r = applyCheckin(card, at(addDaysSP("2026-08-01", 91)), STAMP_CARD_DEFAULTS);
    expect(r).toMatchObject({ renewed: true });
    expect(r.card.stamps).toBe(1);
  });
});
