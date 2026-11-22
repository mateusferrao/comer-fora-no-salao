import { describe, expect, it } from "vitest";
import { buildCandidates, fallbackChoices, proposeAgora, proposeRecompensa, toPlanCandidate } from "@/src/modules/onboarding/domain/candidates";
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import type { Slot } from "@/src/modules/beneficios/domain/slots";

// Cardápio da vitrine (src/db/seed/vitrine.ts): ticket R$ 85, margem 65%.
const M = (id: string, category: MenuItem["category"], priceCents: number): MenuItem => ({ id, category, name: id, priceCents });
const MENU: MenuItem[] = [
  M("bruschetta", "entrada", 2600), M("burrata", "entrada", 4200), M("carpaccio", "entrada", 3900),
  M("fritto", "porcao", 4800), M("arancini", "porcao", 3200), M("polpette", "porcao", 3600),
  M("carbonara", "prato", 6200), M("lasanha", "prato", 6400), M("risoto", "prato", 6800), M("margherita", "prato", 5800), M("calabresa", "prato", 5600), M("nhoque", "prato", 5200),
  M("panna", "sobremesa", 1800), M("cannoli", "sobremesa", 2200), M("tiramisu", "sobremesa", 2600), M("gelato", "sobremesa", 1600),
  M("soda", "bebida", 1600), M("limonada", "bebida", 1400), M("agua", "bebida", 800), M("vinho", "bebida", 2800),
];
const A: Slot = { id: "A", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 10 };
const B: Slot = { id: "B", days: [1, 2, 3], startMin: 1260, endMin: 1380, intensity: "um_pouco", extraTables: 5 };

describe("candidatas (código decide dinheiro; nota só econômica — D121)", () => {
  it("vitrine: água fora (< 15% do ticket), agora e recompensa fora; 3 famílias pela nota", () => {
    const [a] = buildCandidates([A], MENU, { ticketCents: 8500, marginPct: 65, exclude: ["panna", "tiramisu"] });
    // custo = preço × (1 − 0,65); desconto 15% = receita perdida
    expect(a!.options.map((o) => [o.id, o.unitCostCents])).toEqual([
      ["A:cortesia:limonada", 490],
      ["A:doce_gratis:gelato", 560],
      ["A:desconto:nhoque", 780],
    ]);
    expect(a!.options[0]!.score).toBeCloseTo(1 - 490 / 8500, 6);
    expect(a!.options.every((o) => o.weeklyCap === 40 && !o.isMax)).toBe(true);
    expect(a!.options[2]!.offer).toEqual({ kind: "desconto", params: { itemId: "nhoque", pct: 15 } });
  });

  it("sem ticket/margem: referência = 2 × preço médio e custo vira 'custo máximo'", () => {
    const [a] = buildCandidates([A], MENU, { exclude: [] });
    expect(a!.options.length).toBe(3);
    expect(a!.options.filter((o) => o.offer.kind !== "desconto").every((o) => o.isMax)).toBe(true);
  });

  it("corta item grátis acima de 50% do ticket e custo conhecido acima de 35%; sem nada válido → 0 candidatas", () => {
    const caro = [M("lagosta", "prato", 40000), M("caviar", "entrada", 30000)];
    expect(buildCandidates([A], caro, { ticketCents: 8500, marginPct: 10, exclude: [] })[0]!.options).toEqual([]);
  });

  it("sem margem nem ticket ainda há candidatas (bug achado no teste das Configurações)", () => {
    const m = [M("panna", "sobremesa", 1800), M("cannoli", "sobremesa", 2200), M("tiramisu", "sobremesa", 2600), M("bruschetta", "entrada", 2600)];
    const [a] = buildCandidates([A], m, { exclude: ["panna", "tiramisu"] });
    expect(a!.options.map((o) => o.offer.params.itemId)).toEqual(["cannoli"]); // bruschetta (R$ 26) passa de 50% da referência (2 × média = R$ 46)
  });

  it("modo sem IA: maior nota ainda não usada, por prioridade das faixas", () => {
    const cs = buildCandidates([B, A], MENU, { ticketCents: 8500, marginPct: 65, exclude: ["panna", "tiramisu"] });
    expect(fallbackChoices([A, B], cs)).toEqual([
      { slotId: "A", candidateId: "A:cortesia:limonada" },
      { slotId: "B", candidateId: "B:doce_gratis:gelato" },
    ]);
  });

  it("veredito 'trocar' (S9, A4): a oferta (tipo + item) sai das candidatas só daquela faixa; outro item da família entra", () => {
    const decl = { ticketCents: 8500, marginPct: 65, exclude: ["panna", "tiramisu"] };
    const [a, b] = buildCandidates([A, B], MENU, { ...decl, avoidBySlot: { A: ["cortesia:limonada"] } });
    expect(a!.options.map((o) => o.id)).not.toContain("A:cortesia:limonada");
    expect(a!.options.map((o) => o.id)).toContain("A:cortesia:soda");
    expect(b!.options.map((o) => o.id)).toContain("B:cortesia:limonada");
  });

  it("veredito 'trocar' sem outra opção: a oferta fica (a faixa não fica sem candidata)", () => {
    const one = [M("bolo", "sobremesa", 1800)];
    const [a] = buildCandidates([A], one, { ticketCents: 8500, marginPct: 65, exclude: [], avoidBySlot: { A: ["doce_gratis:bolo"] } });
    expect(a!.options.map((o) => o.id)).toContain("A:doce_gratis:bolo");
  });

  it("veredito 'trocar' no modo sem IA: pula a oferta quando há outra", () => {
    const cs = buildCandidates([A, B], MENU, { ticketCents: 8500, marginPct: 65, exclude: ["panna", "tiramisu"] });
    expect(fallbackChoices([A, B], cs, { A: ["cortesia:limonada"] })[0]).toEqual({ slotId: "A", candidateId: "A:doce_gratis:gelato" });
  });

  it("formato do plano (planContentSchema): offer plano {kind,itemId,pct}", () => {
    const [a] = buildCandidates([A], MENU, { ticketCents: 8500, marginPct: 65, exclude: [] });
    expect(toPlanCandidate(a!.options.find((o) => o.offer.kind === "desconto")!)).toEqual({ id: "A:desconto:nhoque", offer: { kind: "desconto", itemId: "nhoque", pct: 15 }, score: expect.any(Number), unitCostCents: 780, weeklyCap: 40 });
  });
});

describe("proposta do agora e da recompensa [C]", () => {
  it("agora: sobremesa mais barata (doce grátis); recompensa: sobremesa mais cara", () => {
    expect(proposeAgora(MENU)).toEqual({ kind: "doce_gratis", params: { itemId: "gelato" } });
    expect(proposeRecompensa(MENU)).toEqual({ kind: "doce_gratis", params: { itemId: "tiramisu" } });
  });
  it("sem sobremesa: cortesia na bebida mais barata; recompensa no prato mais barato", () => {
    const m = MENU.filter((i) => i.category !== "sobremesa");
    expect(proposeAgora(m)).toEqual({ kind: "cortesia", params: { itemId: "agua" } });
    expect(proposeRecompensa(m)).toEqual({ kind: "leve2pague1", params: { itemId: "nhoque" } });
  });
});

describe("convite não vale menos que o benefício da 1ª visita (revisão da S2)", () => {
  it("com piso, a família prefere o item que alcança o valor; as que alcançam vêm antes", () => {
    const menu = [
      { id: "cookie", category: "sobremesa" as const, name: "Cookie", priceCents: 1600 },
      { id: "brownie", category: "sobremesa" as const, name: "Brownie", priceCents: 2200 },
      { id: "refri", category: "bebida" as const, name: "Refri", priceCents: 900 },
      { id: "milk", category: "bebida" as const, name: "Milkshake", priceCents: 1900 },
      { id: "batata", category: "entrada" as const, name: "Batata", priceCents: 2400 },
      { id: "burger", category: "prato" as const, name: "Burger", priceCents: 3800 },
    ];
    const slot = { id: "s1", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito" as const, extraTables: 4 };
    const sem = buildCandidates([slot], menu, { exclude: ["cookie"], ticketCents: 5000 })[0]!.options.map((o) => o.offer.params.itemId);
    expect(sem).toContain("refri");
    const com = buildCandidates([slot], menu, { exclude: ["cookie"], ticketCents: 5000, minValueCents: 1600 })[0]!.options.map((o) => o.offer.params.itemId);
    expect(com).not.toContain("refri");
    expect(com).toContain("milk");
  });
});
