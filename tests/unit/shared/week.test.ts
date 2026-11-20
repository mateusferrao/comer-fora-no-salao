import { describe, expect, it } from "vitest";
import { addDaysSP, dayDiff, instantSP, weekKeySP } from "@/src/shared/week";
import { daySP, minutesOfDaySP } from "@/src/shared/tz";

describe("semana ISO em SP", () => {
  it("23/11/2026 17h10 em SP é 2026-W48", () => {
    expect(weekKeySP(new Date("2026-11-23T20:10:00Z"))).toBe("2026-W48");
  });
  it("virada de domingo 23:59 para segunda 00:00 em SP", () => {
    expect(weekKeySP(new Date("2026-11-23T02:59:00Z"))).toBe("2026-W47"); // dom 22/11 23:59 SP
    expect(weekKeySP(new Date("2026-11-23T03:00:00Z"))).toBe("2026-W48"); // seg 23/11 00:00 SP
  });
  it("virada do ano: 2027-01-01 ainda é 2026-W53", () => {
    expect(weekKeySP(new Date("2027-01-01T15:00:00Z"))).toBe("2026-W53");
    expect(weekKeySP(new Date("2027-01-04T15:00:00Z"))).toBe("2027-W01");
  });
});

describe("aritmética de dias em SP", () => {
  it("soma dias atravessando meses", () => {
    expect(addDaysSP("2026-11-23", 30)).toBe("2026-12-23");
    expect(addDaysSP("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysSP("2026-11-23", -60)).toBe("2026-09-24");
  });
  it("diferença em dias", () => {
    expect(dayDiff("2026-11-23", "2026-12-23")).toBe(30);
    expect(dayDiff("2026-11-23", "2026-11-22")).toBe(-1);
  });
  it("instante de uma hora de parede em SP", () => {
    const at = instantSP("2026-11-23", 17 * 60 + 10);
    expect(at.toISOString()).toBe("2026-11-23T20:10:00.000Z");
    expect(daySP(at)).toBe("2026-11-23");
    expect(minutesOfDaySP(at)).toBe(1030);
  });
});
