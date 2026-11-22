import { describe, expect, it } from "vitest";
import { previewProposal, type Snapshot } from "@/src/modules/agente/domain/proposals";

// Retrato parecido com a Cantina (seed): Tiramisù é a recompensa; faixa A = Ter–Qui 15h–18h com Cannoli.
const snap: Snapshot = {
  marginPct: 60,
  opening: [{ days: [0, 1, 2, 3, 4, 5, 6], startMin: 11 * 60, endMin: 24 * 60 }],
  agora: { kind: "doce_gratis", itemId: "panna" },
  recompensa: { kind: "doce_gratis", itemId: "tiramisu" },
  slots: [
    { id: "A", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 2, offer: { kind: "doce_gratis", itemId: "cannoli" }, weeklyCap: 8, inviteText: "Volte {horario:A} e aproveite {oferta}." },
    { id: "B", days: [1, 2, 3], startMin: 1260, endMin: 1380, intensity: "um_pouco", extraTables: 1, offer: { kind: "entrada_gratis", itemId: "bruschetta" }, weeklyCap: 4, inviteText: "" },
  ],
  menu: [
    { id: "panna", name: "Panna cotta", category: "sobremesa", priceCents: 1800, active: true, inUse: true, offerAllowed: true },
    { id: "cannoli", name: "Cannoli", category: "sobremesa", priceCents: 2200, active: true, inUse: true, offerAllowed: true },
    { id: "tiramisu", name: "Tiramisù", category: "sobremesa", priceCents: 2600, active: true, inUse: true, offerAllowed: true },
    { id: "gelato", name: "Gelato artesanal", category: "sobremesa", priceCents: 2000, active: true, inUse: false, offerAllowed: true },
    { id: "bruschetta", name: "Bruschetta", category: "entrada", priceCents: 2400, active: true, inUse: true, offerAllowed: true },
    { id: "lasanha", name: "Lasanha", category: "prato", priceCents: 5800, active: true, inUse: false, offerAllowed: true },
    { id: "soda", name: "Soda italiana", category: "bebida", priceCents: 1600, active: true, inUse: false, offerAllowed: false },
  ],
};

describe("prévia do copiloto — oferta (S8)", () => {
  it("convite: troca Cannoli por Gelato na faixa A, com alcance, teto e custo do código", () => {
    const p = previewProposal(snap, { acao: "oferta", papel: "convite", slotId: "A", offer: { kind: "doce_gratis", itemId: "gelato" } });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.titulo).toBe("Trocar a oferta do convite de Ter, Qua, Qui · 15h–18h");
    expect(p.alcance).toBe("Vale para Ter, Qua, Qui · 15h–18h");
    expect(p.linhas).toContainEqual({ campo: "Oferta", antes: "Cannoli grátis", depois: "Gelato artesanal grátis" });
    // custo do Gelato = 2000 × (1 − 60%) = R$ 8; teto 8 → R$ 64
    expect(p.impacto).toBe("Até 8 convites por semana · custo máximo de R$ 64,00 por semana");
    expect(p.avisos).toContain("Convites já emitidos continuam com a oferta antiga.");
    expect(p.aba).toBe("convites");
  });
  it("convite: novo teto entra no impacto e na linha", () => {
    const p = previewProposal(snap, { acao: "oferta", papel: "convite", slotId: "A", offer: { kind: "doce_gratis", itemId: "cannoli" }, weeklyCap: 12 });
    expect(p.ok && p.linhas).toContainEqual({ campo: "Teto semanal", antes: "8 convites", depois: "12 convites" });
    expect(p.ok && p.impacto).toBe("Até 12 convites por semana · custo máximo de R$ 105,60 por semana");
  });
  it("desconto de 60% → recusa com a regra", () => {
    const p = previewProposal(snap, { acao: "oferta", papel: "convite", slotId: "A", offer: { kind: "desconto", itemId: "lasanha", pct: 60 } });
    expect(p).toEqual({ ok: false, motivo: "O desconto passa do teto de 50%." });
  });
  it("item fora das ofertas → recusa", () => {
    const p = previewProposal(snap, { acao: "oferta", papel: "agora", offer: { kind: "cortesia", itemId: "soda" } });
    expect(p).toEqual({ ok: false, motivo: "“Soda italiana” está marcado como fora das ofertas." });
  });
  it("nada muda → recusa", () => {
    const p = previewProposal(snap, { acao: "oferta", papel: "convite", slotId: "A", offer: { kind: "doce_gratis", itemId: "cannoli" } });
    expect(p).toEqual({ ok: false, motivo: "Isso já está assim." });
  });
  it("texto que cita outro prato volta ao padrão, com aviso", () => {
    const s2 = { ...snap, slots: [{ ...snap.slots[0]!, inviteText: "Volte {horario:A} e prove o {prato:cannoli}." }, snap.slots[1]!] };
    const p = previewProposal(s2, { acao: "oferta", papel: "convite", slotId: "A", offer: { kind: "doce_gratis", itemId: "gelato" } });
    expect(p.ok && p.inviteText).toBe("Volte {horario:A} e aproveite {oferta}.");
    expect(p.ok && p.avisos).toContain("O texto do convite citava o prato antigo e volta ao texto padrão.");
  });
});

describe("prévia do copiloto — item e faixa (S8)", () => {
  it("Tiramisù indisponível → recusa: é a recompensa da cartela", () => {
    expect(previewProposal(snap, { acao: "item", itemId: "tiramisu", mudanca: "indisponivel" })).toEqual({
      ok: false,
      motivo: "“Tiramisù” é a recompensa da cartela. Troque a recompensa antes de tirar o prato do cardápio.",
    });
  });
  it("Lasanha indisponível → ok, aba cardápio", () => {
    const p = previewProposal(snap, { acao: "item", itemId: "lasanha", mudanca: "indisponivel" });
    expect(p.ok && p.linhas).toEqual([{ campo: "No cardápio", antes: "Sim", depois: "Não" }]);
    expect(p.ok && p.aba).toBe("cardapio");
  });
  it("preço da Lasanha para R$ 62,00", () => {
    const p = previewProposal(snap, { acao: "item", itemId: "lasanha", mudanca: "preco", priceCents: 6200 });
    expect(p.ok && p.linhas).toEqual([{ campo: "Preço", antes: "R$ 58,00", depois: "R$ 62,00" }]);
  });
  it("faixa A até 19h", () => {
    const p = previewProposal(snap, { acao: "faixa", slotId: "A", mudanca: "editar", endMin: 1140 });
    expect(p.ok && p.linhas).toContainEqual({ campo: "Horário", antes: "Ter, Qua, Qui · 15h–18h", depois: "Ter, Qua, Qui · 15h–19h" });
  });
  it("faixa fora do funcionamento → recusa", () => {
    const p = previewProposal(snap, { acao: "faixa", slotId: "A", mudanca: "editar", startMin: 480 });
    expect(p).toEqual({ ok: false, motivo: "O horário fica fora do funcionamento do restaurante." });
  });
  it("desativar a faixa B → ok com aviso", () => {
    const p = previewProposal(snap, { acao: "faixa", slotId: "B", mudanca: "desativar" });
    expect(p.ok && p.avisos).toContain("Convites já emitidos para esse horário continuam valendo.");
  });
  it("última faixa não sai", () => {
    const one = { ...snap, slots: [snap.slots[0]!] };
    expect(previewProposal(one, { acao: "faixa", slotId: "A", mudanca: "desativar" })).toEqual({ ok: false, motivo: "É o único horário vazio: o convite precisa de pelo menos um." });
  });
  it("id desconhecido → recusa", () => {
    expect(previewProposal(snap, { acao: "item", itemId: "x", mudanca: "indisponivel" })).toEqual({ ok: false, motivo: "Não encontrei esse prato no cardápio." });
  });
});

describe("prévia do copiloto — onda 2 (S8, D270)", () => {
  const withPlan: Snapshot = { ...snap, tone: null, ticketCents: 7800, resumo: { on: true, weekday: 1, minute: 510 }, plan: { id: "p1", slots: [{ slotId: "A", offer: { kind: "doce_gratis", itemId: "cannoli" }, weeklyCap: 8, inviteText: "Volte {horario:A} e prove o {prato:cannoli}." }], audience: 42 } };
  it("aprovar o plano com troca: linhas, aviso da reativação e do texto", () => {
    const p = previewProposal(withPlan, { acao: "plano", planId: "p1", slotId: "A", offer: { kind: "doce_gratis", itemId: "gelato" } });
    expect(p.ok && p.titulo).toBe("Aprovar o plano da semana com ajuste");
    expect(p.ok && p.linhas).toContainEqual({ campo: "Plano da semana", antes: "Sugerido", depois: "Aprovado" });
    expect(p.ok && p.avisos[0]).toBe("Ao aprovar, o convite para quem sumiu vai para até 42 clientes (no app e por e-mail para quem aceitou).");
    expect(p.ok && p.avisos).toContain("O texto do convite desse horário citava o prato antigo e volta ao texto padrão.");
  });
  it("plano errado → recusa", () => {
    expect(previewProposal(withPlan, { acao: "plano", planId: "outro" }).ok).toBe(false);
  });
  it("resumo: segunda 08:30 → desligado", () => {
    const p = previewProposal(withPlan, { acao: "avisos", resumoOn: false });
    expect(p.ok && p.linhas).toEqual([{ campo: "Resumo da semana", antes: "segunda, 08:30", depois: "desligado" }]);
  });
  it("ticket: R$ 78,00 → R$ 90,00", () => {
    const p = previewProposal(withPlan, { acao: "restaurante", ticketCents: 9000 });
    expect(p.ok && p.linhas).toEqual([{ campo: "Ticket médio por pessoa", antes: "R$ 78,00", depois: "R$ 90,00" }]);
  });
  it("item novo com nome repetido → recusa", () => {
    expect(previewProposal(withPlan, { acao: "item_novo", name: "cannoli", category: "sobremesa", priceCents: 2000 }).ok).toBe(false);
  });
});

