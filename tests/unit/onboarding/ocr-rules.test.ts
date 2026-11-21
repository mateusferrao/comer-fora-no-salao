import { describe, expect, it } from "vitest";
import { parseOcr } from "@/eval/ocr-rules";

describe("linha de base OCR + regras", () => {
  it("seção vira categoria; linha com preço vira item; vários tamanhos viram itens", () => {
    const txt = "PETISCOS\nMandioca frita ........ R$ 29,90\ncom maionese da casa\nBEBIDAS\nChopp claro ..... 300 ml 12,00 · 500 ml 18,00\nÁgua com gás R$ 5,50";
    expect(parseOcr(txt)).toEqual([
      { categoria: "porcao", nome: "Mandioca frita", precoCentavos: 2990 },
      { categoria: "bebida", nome: "Chopp claro 300 ml", precoCentavos: 1200 },
      { categoria: "bebida", nome: "Chopp claro 500 ml", precoCentavos: 1800 },
      { categoria: "bebida", nome: "Água com gás", precoCentavos: 550 },
    ]);
  });
});
