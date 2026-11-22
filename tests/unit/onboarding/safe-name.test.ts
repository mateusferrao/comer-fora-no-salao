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
  it("revisão S9: contato disfarçado no nome é recusado", () => {
    for (const n of ["Cantina 11 9 87 65 43 21", "Cantina 11.98765.4321", "@cantinadabia", "Cantina arroba gmail", "Cantina ponto com", "Cantina zap onze nove", "Peça no whats", "Siga no insta", "Cantina wpp", "Telegram da Bia", "linktr.ee/x", "Cantina bit.ly"]) {
      expect([n, restaurantNameProblem(n)]).toEqual([n, "nome_contato"]);
      expect([n, dishNameProblem(n)]).toEqual([n, "item_contato"]);
    }
  });
  it("revisão S9: marca disfarçada (zero, um, i sem ponto, letras cirílicas) é recusada", () => {
    for (const n of ["iF00d", "1Food Express", "ıFood", "Ifооd", "I-F0OD Suporte", "ｉＦｏｏｄ"]) {
      expect([n, restaurantNameProblem(n)]).toEqual([n, "nome_marca"]);
      expect([n, dishNameProblem(n)]).toEqual([n, "item_marca"]);
    }
  });
  it("revisão S9: letras fora do alfabeto latino são recusadas; acento e ligaduras comuns passam", () => {
    expect(restaurantNameProblem("Сантина")).toBe("nome_marca");
    expect(dishNameProblem("Sushi 寿司")).toBe("item_marca");
    for (const n of ["Crème brûlée", "Bœuf bourguignon", "Smørrebrød", "Strudel da Straße", "Pizza nº 1", "Ñoquis", "Açaí", "Kebapçı"]) expect([n, dishNameProblem(n)]).toEqual([n, null]);
  });
  it("revisão S9: nomes legítimos com número, ponto ou cidade continuam passando", () => {
    for (const n of ["Cantina 1900", "Bar 2 Irmãos", "Empório São Paulo", "Sr. Burger", "Café & Cia.", "Bar do Zé", "Insalata Mista", "Zapata Tacos", "Comida da Ponto Certo"]) expect([n, restaurantNameProblem(n)]).toEqual([n, null]);
    for (const n of ["Pizza 4 queijos", "Combo 2 pessoas (500 g)", "Vinho tinto 750 ml", "Água c/ gás 500ml", "Prato do dia (seg. a sex.)", "Picanha 1 kg"]) expect([n, dishNameProblem(n)]).toEqual([n, null]);
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
