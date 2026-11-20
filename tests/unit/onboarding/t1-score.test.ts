import { describe, expect, it } from "vitest";
import { composite, score, similarity } from "@/eval/score";

describe("pontuação da T1", () => {
  it("nome normalizado: acentos e caixa não importam", () => {
    expect(similarity("Água com gás", "agua com gas")).toBe(1);
    expect(similarity("Chopp claro 300 ml", "Chopp Claro (300ml)")).toBeGreaterThan(0.8);
    expect(similarity("Pudim de leite", "Cocada de forno")).toBeLessThan(0.5);
  });
  it("F1, preço exato (sobre o esperado) e categoria", () => {
    const exp = [
      { categoria: "prato", nome: "Feijoada", precoCentavos: 5490 },
      { categoria: "bebida", nome: "Água", precoCentavos: 550 },
    ];
    const got = [
      { categoria: "prato", nome: "Feijoada", precoCentavos: 5490 },
      { categoria: "sobremesa", nome: "Agua", precoCentavos: 500 },
      { categoria: "prato", nome: "Inventado", precoCentavos: 100 },
    ];
    const s = score(exp, got);
    expect(s.matched).toBe(2);
    expect(s.recall).toBe(1);
    expect(s.precision).toBeCloseTo(2 / 3);
    expect(s.priceExact).toBe(0.5);
    expect(s.category).toBe(0.5);
    expect(composite(s)).toBeCloseTo(0.5 * 0.5 + 0.4 * 0.8 + 0.1 * 0.5);
  });
});
