import { describe, expect, it } from "vitest";
import { dishNameProblem, restaurantNameProblem, NAME_PROBLEM_TEXT } from "@/src/modules/onboarding/domain/safe-name";
import { cleanExtraction } from "@/src/modules/onboarding/domain/menu-extraction";

describe("S9 (segurança M1): nome do restaurante e do prato vão no assunto e no corpo dos e-mails", () => {
  it("nome do restaurante: contato e marca iFood recusados; nome comum passa", () => {
    expect(restaurantNameProblem("Cantina Nonna Lúcia")).toBeNull();
    expect(restaurantNameProblem("Bar 2 Irmãos")).toBeNull();
    expect(restaurantNameProblem("Ganhe pix em golpe.com")).toBe("nome_contato");
    expect(restaurantNameProblem("Suporte (11) 91234-5678")).toBe("nome_contato");
    expect(restaurantNameProblem("fale com ana@x.com")).toBe("nome_contato");
    expect(restaurantNameProblem("iFood Suporte")).toBe("nome_marca");
  });
  it("nome do prato: contato e marca iFood recusados; prato comum passa", () => {
    expect(dishNameProblem("Pizza 4 queijos")).toBeNull();
    expect(dishNameProblem("Combo 2 pessoas (500 g)")).toBeNull();
    expect(dishNameProblem("Peça pelo zap 11912345678")).toBe("item_contato");
    expect(dishNameProblem("Promo www.golpe.com")).toBe("item_contato");
    expect(dishNameProblem("Combo i-Food")).toBe("item_marca");
  });
  it("cada recusa tem uma mensagem que diz o que fazer", () => {
    for (const k of ["nome_contato", "nome_marca", "item_contato", "item_marca"] as const) expect(NAME_PROBLEM_TEXT[k]).toMatch(/^[A-ZO].+\.$/);
  });
  it("extração: prato com contato ou marca vem marcado para conferir", () => {
    const r = cleanExtraction({ ehCardapio: true, parcial: false, culinaria: null, faixaPreco: null, itens: [
      { categoria: "prato", nome: "Lasanha", precoCentavos: 5000 },
      { categoria: "prato", nome: "Peça no zap 11912345678", precoCentavos: 5000 },
      { categoria: "prato", nome: "Combo iFood", precoCentavos: 5000 },
    ] });
    expect(r.itens.map((i) => i.confira)).toEqual([false, true, true]);
  });
});
