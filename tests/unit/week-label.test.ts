import { describe, expect, it } from "vitest";
import { weekLabel } from "@/src/ui/painel/format";

describe("weekLabel", () => {
  it("semana ISO vira intervalo de datas", () => {
    expect(weekLabel("2026-W48")).toBe("23–29/11");
    expect(weekLabel("2026-W49")).toBe("30/11–06/12");
    expect(weekLabel("2026-W01")).toBe("29/12–04/01");
  });
});
