import { describe, expect, it } from "vitest";
import { daySP, endOfDaySP, minutesOfDaySP, weekdaySP } from "@/src/shared/tz";

// 23/11/2026 17h10 em São Paulo (UTC−3) — horário da entrevista.
const entrevista = new Date("2026-11-23T20:10:00Z");

describe("fuso de São Paulo", () => {
  it("daySP devolve o dia de SP", () => {
    expect(daySP(entrevista)).toBe("2026-11-23");
  });

  it("weekdaySP: 23/11/2026 é segunda (0 = domingo)", () => {
    expect(weekdaySP(entrevista)).toBe(1);
  });

  it("minutesOfDaySP: 17h10 = 1030", () => {
    expect(minutesOfDaySP(entrevista)).toBe(1030);
  });

  it("23h30 em SP já é dia seguinte em UTC, mas continua 23/11 em SP", () => {
    expect(daySP(new Date("2026-11-24T02:30:00Z"))).toBe("2026-11-23");
  });

  it("endOfDaySP devolve 23:59:59.999 de SP em UTC", () => {
    expect(endOfDaySP(entrevista).toISOString()).toBe("2026-11-24T02:59:59.999Z");
  });

  it("meia-noite em SP: minuto 0 e dia novo", () => {
    const meiaNoite = new Date("2026-11-24T03:00:00Z");
    expect(daySP(meiaNoite)).toBe("2026-11-24");
    expect(minutesOfDaySP(meiaNoite)).toBe(0);
    expect(weekdaySP(meiaNoite)).toBe(2);
  });

  it("respeita horário de verão histórico (15/01/2019, UTC−2)", () => {
    expect(endOfDaySP(new Date("2019-01-15T15:00:00Z")).toISOString()).toBe("2019-01-16T01:59:59.999Z");
  });
});
