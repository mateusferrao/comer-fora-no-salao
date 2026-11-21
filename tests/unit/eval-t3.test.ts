import { describe, expect, it } from "vitest";
import { cohenKappa, parseAnswers, wilson } from "@/eval/relatorio-t3";

describe("T3: concordância", () => {
  it("lê respostas no formato do chat", () => {
    expect([...parseAnswers("1A 2b 3empate 4 E, 5B")]).toEqual([[1, "A"], [2, "B"], [3, "empate"], [4, "empate"], [5, "B"]]);
  });
  it("Wilson e κ", () => {
    const [lo, hi] = wilson(8, 9);
    expect(lo).toBeCloseTo(0.565, 2);
    expect(hi).toBeCloseTo(0.98, 2);
    expect(cohenKappa(["A", "B", "A", "B"], ["A", "B", "A", "B"])).toBe(1);
    expect(cohenKappa(["A", "A"], ["A", "A"])).toBeNull();
  });
});
