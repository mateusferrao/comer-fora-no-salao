import { describe, expect, it } from "vitest";
import { averagePriceCents, type MenuItem } from "@/src/modules/beneficios/domain/menu";
import { describeOffer, minSpendAlert, offerRegistry, unitCost, validateOffer } from "@/src/modules/beneficios/domain/offers";

const menu: MenuItem[] = [
  { id: "panna", category: "sobremesa", name: "Panna cotta", priceCents: 1800 },
  { id: "bruschetta", category: "entrada", name: "Bruschetta", priceCents: 2600 },
  { id: "fritto", category: "porcao", name: "Fritto misto", priceCents: 4800 },
  { id: "carbonara", category: "prato", name: "Spaghetti à carbonara", priceCents: 6200 },
  { id: "soda", category: "bebida", name: "Soda italiana", priceCents: 1600 },
];

describe("ofertas polimórficas", () => {
  it("registro tem os 5 tipos reais", () => {
    expect(Object.keys(offerRegistry).sort()).toEqual(["cortesia", "desconto", "doce_gratis", "entrada_gratis", "leve2pague1"]);
  });
  it("desconto acima de 50% é recusado", () => {
    expect(validateOffer({ kind: "desconto", params: { itemId: "fritto", pct: 51 } }, menu)).toEqual(["desconto_acima_do_teto"]);
    expect(validateOffer({ kind: "desconto", params: { itemId: "fritto", pct: 50 } }, menu)).toEqual([]);
  });
  it("item precisa existir e ser da categoria permitida", () => {
    expect(validateOffer({ kind: "doce_gratis", params: { itemId: "carbonara" } }, menu)).toEqual(["categoria_incompativel"]);
    expect(validateOffer({ kind: "doce_gratis", params: { itemId: "xx" } }, menu)).toEqual(["item_inexistente"]);
    expect(validateOffer({ kind: "entrada_gratis", params: { itemId: "fritto" } }, menu)).toEqual([]);
    expect(validateOffer({ kind: "cortesia", params: { itemId: "soda" } }, menu)).toEqual([]);
    expect(validateOffer({ kind: "cortesia", params: { itemId: "carbonara" } }, menu)).toEqual(["categoria_incompativel"]);
    expect(validateOffer({ kind: "leve2pague1", params: { itemId: "carbonara" } }, menu)).toEqual([]);
  });
  it("parâmetros inválidos pelo schema", () => {
    expect(validateOffer({ kind: "desconto", params: { itemId: "fritto" } }, menu)).toEqual(["parametros_invalidos"]);
  });
  it("custo = preço × (1 − margem); sem margem = preço como máximo", () => {
    expect(unitCost({ kind: "doce_gratis", params: { itemId: "panna" } }, menu, 65)).toEqual({ cents: 630, isMax: false });
    expect(unitCost({ kind: "doce_gratis", params: { itemId: "panna" } }, menu)).toEqual({ cents: 1800, isMax: true });
    expect(unitCost({ kind: "leve2pague1", params: { itemId: "fritto" } }, menu, 50)).toEqual({ cents: 2400, isMax: false });
  });
  it("desconto custa a receita perdida", () => {
    expect(unitCost({ kind: "desconto", params: { itemId: "fritto", pct: 20 } }, menu, 65)).toEqual({ cents: 960, isMax: false });
  });
  it("consumo mínimo acima de 2× o preço médio gera alerta", () => {
    expect(averagePriceCents(menu)).toBe(3400);
    expect(minSpendAlert({ kind: "doce_gratis", params: { itemId: "panna", minSpendCents: 6800 } }, menu)).toBe(false);
    expect(minSpendAlert({ kind: "doce_gratis", params: { itemId: "panna", minSpendCents: 6801 } }, menu)).toBe(true);
  });
  it("descrição vem do código, por papel", () => {
    expect(describeOffer({ kind: "doce_gratis", params: { itemId: "panna" } }, menu, "agora")).toEqual({
      title: "Doce grátis",
      subtitle: "Pra novos clientes",
      itemName: "Panna cotta",
      gain: "Panna cotta grátis",
    });
    expect(describeOffer({ kind: "desconto", params: { itemId: "fritto", pct: 20 } }, menu, "convite")).toMatchObject({
      title: "20% de desconto",
      subtitle: "No seu convite",
      gain: "20% de desconto em Fritto misto",
    });
    expect(describeOffer({ kind: "leve2pague1", params: { itemId: "fritto" } }, menu, "recompensa")).toMatchObject({
      title: "Leve 2, pague 1",
      subtitle: "Na cartela",
      gain: "Leve 2, pague 1 em Fritto misto",
    });
  });
});
