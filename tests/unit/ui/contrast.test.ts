import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/src/ui/contrast";
import { COLORS } from "@/src/ui/tokens";

describe("contrastRatio (WCAG 2.x)", () => {
  it("preto/branco = 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });
  it("é simétrico e aceita minúsculas", () => {
    expect(contrastRatio("#ffffff", "#151515")).toBeCloseTo(contrastRatio("#151515", "#FFFFFF"), 10);
  });
  it("recusa cor inválida", () => {
    expect(() => contrastRatio("vermelho", "#FFFFFF")).toThrow();
  });
});

// Pares declarados no planejamento S0 §7.1 (texto ≥ 4,5; gráfico ≥ 3).
const PAIRS: Array<[string, string, string, number]> = [
  ["branco / botão principal do app", COLORS.white, COLORS.ink, 4.5],
  ["texto / botão secundário", COLORS.ink, COLORS.surfaceMuted, 4.5],
  ["branco / botão vermelho", COLORS.white, COLORS.redButton, 4.5],
  ["texto vermelho / branco", COLORS.redText, COLORS.white, 4.5],
  ["texto escuro / verde", COLORS.ink, COLORS.green, 4.5],
  ["funil / branco (gráfico)", COLORS.redChart, COLORS.white, 3],
  ["texto da barra / fundo da barra", COLORS.protoFg, COLORS.protoBg, 4.5],
  ["texto secundário / branco", COLORS.inkMuted, COLORS.white, 4.5],
  ["texto secundário / chip", COLORS.inkMuted, COLORS.surfaceMuted, 4.5],
  ["texto secundário / sheet", COLORS.inkMuted, COLORS.sheet, 4.5],
  ["item ativo do Portal (texto vermelho / rosado)", COLORS.redText, COLORS.navActive, 4.5],
];

describe("pares de tokens", () => {
  it.each(PAIRS)("%s ≥ %s", (_nome, fg, bg, min) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it("branco sobre o verde reprova (por isso o Badge verde usa texto escuro)", () => {
    expect(contrastRatio(COLORS.white, COLORS.green)).toBeLessThan(4.5);
  });
});

describe("tokens.ts × tokens.css", () => {
  it("toda cor do TS está declarada no CSS", () => {
    const css = readFileSync(path.resolve(__dirname, "../../../src/ui/tokens.css"), "utf8").toLowerCase();
    for (const [nome, valor] of Object.entries(COLORS)) {
      expect(css, `${nome} = ${valor}`).toContain(valor.toLowerCase());
    }
  });
});
