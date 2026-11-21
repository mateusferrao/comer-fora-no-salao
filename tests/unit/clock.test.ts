import { describe, expect, it } from "vitest";
import { adjustableClock, fixedClock, systemClock } from "@/src/shared/clock";

describe("Clock", () => {
  it("fixedClock devolve sempre o mesmo instante", () => {
    const c = fixedClock("2026-11-23T20:10:00Z");
    expect(c.now().toISOString()).toBe("2026-11-23T20:10:00.000Z");
    expect(c.now().toISOString()).toBe("2026-11-23T20:10:00.000Z");
  });

  it("fixedClock devolve cópias (mutar o retorno não altera o relógio)", () => {
    const c = fixedClock("2026-11-23T20:10:00Z");
    c.now().setFullYear(2000);
    expect(c.now().getUTCFullYear()).toBe(2026);
  });

  it("adjustableClock avança e troca o instante", () => {
    const c = adjustableClock("2026-11-23T18:30:00Z");
    c.advance(100 * 60 * 1000);
    expect(c.now().toISOString()).toBe("2026-11-23T20:10:00.000Z");
    c.set("2026-11-24T12:00:00Z");
    expect(c.now().toISOString()).toBe("2026-11-24T12:00:00.000Z");
  });

  it("systemClock acompanha o relógio do sistema", () => {
    const antes = Date.now();
    const agora = systemClock.now().getTime();
    expect(agora).toBeGreaterThanOrEqual(antes);
    expect(agora - antes).toBeLessThan(1_000);
  });

  it("ISO inválido é recusado", () => {
    expect(() => fixedClock("ontem")).toThrow();
  });
});
