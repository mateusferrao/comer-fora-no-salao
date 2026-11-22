import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { closeDb, getDb, getPool } from "@/src/db/client";
import { agentProposals, benefitVersions, menuItems, ownerEdits, restaurants, weeklyPlans } from "@/src/db/schema";
import { generateWeeklyPlan } from "@/src/modules/planos/application/generate-plan";
import { APPLYING_STALE_MS, createProposals, decideProposal, PROPOSAL_TTL_MS, sweepProposals } from "@/src/modules/agente/application/proposals";
import { runSchedulerTick } from "@/src/modules/agendador/application/tick";
import { appliedProposalTitle, getCopilotMetrics } from "@/src/modules/agente/application/metrics";
import { updateOffer } from "@/src/modules/config/application/update-settings";
import { createRestaurant, resetDb } from "./helpers/db";

const NOW = new Date("2026-11-23T16:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

describe("propostas do copiloto (S8 — D261, D269)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("proposta de convite → aplicar → versão nova, owner_edits e status aplicada", async () => {
    const r = await createRestaurant();
    const [card] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "oferta", papel: "convite", slotId: r.slots.A!, offer: { kind: "entrada_gratis", itemId: r.items.bruschetta! }, weeklyCap: 12 }], now: NOW });
    expect(card!.status).toBe("pendente");
    const res = await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: card!.id!, origin: "copiloto", acao: "aplicar", now: later(1000) });
    expect(res).toMatchObject({ ok: true, status: "aplicada", aba: "convites" });
    const [v] = await getDb().select().from(benefitVersions).where(and(eq(benefitVersions.restaurantId, r.restaurantId), isNull(benefitVersions.supersededAt), eq(benefitVersions.weeklyCap, 12)));
    expect(v!.params).toMatchObject({ itemId: r.items.bruschetta });
    expect(v!.inviteText).toBeTruthy();
    const edits = await getDb().select().from(ownerEdits).where(eq(ownerEdits.restaurantId, r.restaurantId));
    expect(edits.some((e) => e.kind === "config:convite")).toBe(true);
    const [row] = await getDb().select().from(agentProposals).where(eq(agentProposals.id, card!.id!));
    expect(row!.status).toBe("aplicada");
  });

  it("faxina do agendador: pendente vencida → expirada (sem_decisao); reserva presa → falhou; recente fica (revisão S8, item 25)", async () => {
    const r = await createRestaurant();
    const offer = (cap: number) => ({ acao: "oferta" as const, papel: "convite" as const, slotId: r.slots.A!, offer: { kind: "entrada_gratis" as const, itemId: r.items.bruschetta! }, weeklyCap: cap });
    const [old] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [offer(11)], now: NOW });
    const [stuck] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "mcp", payloads: [offer(12)], now: NOW });
    await getDb().update(agentProposals).set({ status: "aplicando" }).where(eq(agentProposals.id, stuck!.id!));
    const [recent] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [offer(13)], now: later(PROPOSAL_TTL_MS) });
    // Tique global (flags do agendador desligadas: a faxina roda mesmo assim).
    const tickAt = later(PROPOSAL_TTL_MS + APPLYING_STALE_MS + 1000);
    await runSchedulerTick(getDb(), tickAt, { sender: null, baseUrl: "http://x", flags: { agendador: false, resumo_email: false }, generatePlan: async () => ({}), sendPending: async () => ({}) });
    const status = async (id: string) => (await getDb().select().from(agentProposals).where(eq(agentProposals.id, id)))[0]!;
    expect(await status(old!.id!)).toMatchObject({ status: "expirada", error: "sem_decisao" });
    expect(await status(stuck!.id!)).toMatchObject({ status: "falhou", error: "reserva_presa" });
    expect((await status(recent!.id!)).status).toBe("pendente");
    expect((await getCopilotMetrics(getDb())).expired).toBe(1);
    // Idempotente.
    expect(await sweepProposals(getDb(), tickAt)).toEqual({ expired: 0, failed: 0 });
  });

  it("restaurante: o UPDATE toca só a margem (nada de regravar endereço/horário lidos antes — revisão S8, item 25)", async () => {
    const r = await createRestaurant();
    const [card] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "restaurante", marginPct: 40 }], now: NOW });
    await getDb().update(restaurants).set({ address: "Rua Nova, 10" }).where(eq(restaurants.id, r.restaurantId));
    const spy = vi.spyOn(getPool(), "query");
    const res = await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: card!.id!, origin: "copiloto", acao: "aplicar", now: later(1000) });
    const updates = spy.mock.calls.map((c) => String((c[0] as { text?: string })?.text ?? c[0])).filter((t) => t.startsWith('update "restaurants"'));
    spy.mockRestore();
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatch(/set "margin_pct" = \$1 where/);
    expect(res).toMatchObject({ ok: true, status: "aplicada" });
    const [row] = await getDb().select().from(restaurants).where(eq(restaurants.id, r.restaurantId));
    expect(row).toMatchObject({ marginPct: 40, address: "Rua Nova, 10" });
    const edits = await getDb().select().from(ownerEdits).where(and(eq(ownerEdits.restaurantId, r.restaurantId), eq(ownerEdits.kind, "config:restaurante")));
    expect(edits.at(-1)!.final).toMatchObject({ marginPct: 40 });
  });

  it("Tiramisù (recompensa) indisponível → recusada, nada gravado", async () => {
    const r = await createRestaurant();
    const [card] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "item", itemId: r.items.tiramisu!, mudanca: "indisponivel" }], now: NOW });
    expect(card).toMatchObject({ id: null, status: "recusada", motivo: "“Tiramisù” é a recompensa da cartela. Troque a recompensa antes de tirar o prato do cardápio." });
    expect(await getDb().select().from(agentProposals)).toHaveLength(0);
  });

  it("2 aplicar em paralelo → 1 efeito", async () => {
    const r = await createRestaurant();
    const [card] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "oferta", papel: "convite", slotId: r.slots.A!, offer: { kind: "entrada_gratis", itemId: r.items.bruschetta! } }], now: NOW });
    const res = await Promise.all([1, 2, 3].map(() => decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: card!.id!, origin: "copiloto", acao: "aplicar", now: later(1000) })));
    // Revisão S8 (técnica A2): só um aplica; os outros dizem "em andamento" ou "já estava", nunca um 2º efeito.
    expect(res.filter((x) => x.ok && !x.already)).toHaveLength(1);
    expect(res.every((x) => x.ok || x.status === "em_andamento")).toBe(true);
    const vs = await getDb().select().from(benefitVersions).where(and(eq(benefitVersions.restaurantId, r.restaurantId), eq(benefitVersions.kind, "entrada_gratis")));
    expect(vs).toHaveLength(1);
  });

  it("outra loja, outra porta ou vencida → não aplica", async () => {
    const r = await createRestaurant();
    const other = await createRestaurant();
    const [card] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "item", itemId: r.items.bruschetta!, mudanca: "preco", priceCents: 3000 }], now: NOW });
    expect(await decideProposal(getDb(), { restaurantId: other.restaurantId, proposalId: card!.id!, origin: "copiloto", acao: "aplicar", now: later(1) })).toMatchObject({ ok: false, status: "nao_encontrada" });
    expect(await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: card!.id!, origin: "mcp", acao: "aplicar", now: later(1) })).toMatchObject({ ok: false, status: "nao_encontrada" });
    expect(await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: card!.id!, origin: "copiloto", acao: "aplicar", now: later(PROPOSAL_TTL_MS + 1) })).toMatchObject({ ok: false, status: "expirada" });
    const [it] = await getDb().select().from(menuItems).where(eq(menuItems.id, r.items.bruschetta!));
    expect(it!.priceCents).toBe(2600);
  });

  it("o 'antes' mudou depois da prévia → expirada, sem aplicar", async () => {
    const r = await createRestaurant();
    const [card] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "oferta", papel: "convite", slotId: r.slots.A!, offer: { kind: "entrada_gratis", itemId: r.items.bruschetta! } }], now: NOW });
    await updateOffer(getDb(), { restaurantId: r.restaurantId, role: "convite", slotId: r.slots.A!, offer: { kind: "doce_gratis", itemId: r.items.panna! }, weeklyCap: 20, inviteText: "", now: later(10) });
    expect(await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: card!.id!, origin: "copiloto", acao: "aplicar", now: later(20) })).toMatchObject({ ok: false, status: "expirada" });
    const vs = await getDb().select().from(benefitVersions).where(and(eq(benefitVersions.restaurantId, r.restaurantId), eq(benefitVersions.kind, "entrada_gratis")));
    expect(vs).toHaveLength(0);
  });

  it("descartar → descartada; aplicar depois não grava", async () => {
    const r = await createRestaurant();
    const [card] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "mcp", payloads: [{ acao: "item", itemId: r.items.bruschetta!, mudanca: "fora_das_ofertas" }], now: NOW });
    expect(await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: card!.id!, origin: "mcp", acao: "descartar", now: later(1) })).toEqual({ ok: true, status: "descartada" });
    expect(await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: card!.id!, origin: "mcp", acao: "aplicar", now: later(2) })).toMatchObject({ ok: false, status: "descartada" });
  });

  it("texto de convite da IA sem o horário → recusada com a regra (D226)", async () => {
    const r = await createRestaurant();
    const [card] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "oferta", papel: "convite", slotId: r.slots.A!, offer: { kind: "entrada_gratis", itemId: r.items.bruschetta! }, inviteText: "Volte logo e aproveite {oferta}." }], now: NOW });
    expect(card!.status).toBe("recusada");
  });

  it("onda 2: aprovar o plano com troca de oferta e teto → aprovado 'copiloto', e-mails agendados pelo chamador", async () => {
    const r = await createRestaurant();
    const g = await generateWeeklyPlan(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: null });
    expect(g.ok).toBe(true);
    const planId = (g as { planId: string }).planId;
    const [card] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "plano", planId, slotId: r.slots.A!, offer: { kind: "entrada_gratis", itemId: r.items.bruschetta! }, weeklyCap: 7 }], now: NOW });
    expect(card).toMatchObject({ status: "pendente" });
    const approved: string[][] = [];
    const res = await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: card!.id!, origin: "copiloto", acao: "aplicar", now: later(1000), onApproved: (_rid, ids) => approved.push(ids) });
    expect(res).toMatchObject({ ok: true, status: "aplicada" });
    const [plan] = await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.id, planId));
    expect(plan!.status).toBe("aprovado");
    expect(plan!.approvedVia).toBe("copiloto");
    const [v] = await getDb().select().from(benefitVersions).where(and(eq(benefitVersions.restaurantId, r.restaurantId), isNull(benefitVersions.supersededAt), eq(benefitVersions.kind, "entrada_gratis")));
    expect(v!.weeklyCap).toBe(7);
  });

  it("onda 2: sem plano proposto → recusa", async () => {
    const r = await createRestaurant();
    const [card] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "plano", planId: crypto.randomUUID() }], now: NOW });
    expect(card).toMatchObject({ status: "recusada" });
  });

  it("onda 2: tom com link → recusa; tom ok, item novo, ticket e resumo → aplicados", async () => {
    const r = await createRestaurant();
    const [bad] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "tom", tone: "Descontraído, veja www.site.com" }], now: NOW });
    expect(bad).toMatchObject({ status: "recusada", motivo: "Tire links do tom." });
    const cards = await createProposals(getDb(), {
      restaurantId: r.restaurantId,
      origin: "copiloto",
      payloads: [
        { acao: "tom", tone: "Descontraído e acolhedor" },
        { acao: "item_novo", name: "Torta de limão", category: "sobremesa", priceCents: 2100 },
        { acao: "restaurante", ticketCents: 9000 },
        { acao: "avisos", resumoOn: false },
      ],
      now: NOW,
    });
    expect(cards.map((c) => c.status)).toEqual(["pendente", "pendente", "pendente", "pendente"]);
    for (const c of cards) expect(await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: c.id!, origin: "copiloto", acao: "aplicar", now: later(10) })).toMatchObject({ ok: true, status: "aplicada" });
    const [rest] = await getDb().select().from(restaurants).where(eq(restaurants.id, r.restaurantId));
    expect(rest!.aiTone).toBe("Descontraído e acolhedor");
    expect(rest!.ticketCents).toBe(9000);
    expect((rest!.notifySettings as { resumo: { on: boolean } }).resumo.on).toBe(false);
    const items = await getDb().select().from(menuItems).where(eq(menuItems.restaurantId, r.restaurantId));
    expect(items.some((i) => i.name === "Torta de limão" && i.priceCents === 2100)).toBe(true);
  });

  it("revisão S8: limites valem no copiloto (margem 150%, resumo 02:00) e reserva presa vira 'falhou'", async () => {
    const r = await createRestaurant();
    const cards = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "restaurante", marginPct: 150 }, { acao: "avisos", minute: 120 }], now: NOW });
    expect(cards.map((c) => c.status)).toEqual(["recusada", "recusada"]);
    const [ok] = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "item", itemId: r.items.bruschetta!, mudanca: "preco", priceCents: 2900 }], now: NOW });
    await getDb().update(agentProposals).set({ status: "aplicando" }).where(eq(agentProposals.id, ok!.id!));
    expect(await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: ok!.id!, origin: "copiloto", acao: "aplicar", now: later(60_000) })).toMatchObject({ ok: false, status: "em_andamento" });
    expect(await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: ok!.id!, origin: "copiloto", acao: "aplicar", now: later(PROPOSAL_TTL_MS + 3 * 60_000) })).toMatchObject({ ok: false, status: "falhou" });
  });

  it("revisão S8: métricas do copiloto (mostradas, aplicadas, %) e título da aplicada pela faixa da tela", async () => {
    const r = await createRestaurant();
    const cards = await createProposals(getDb(), { restaurantId: r.restaurantId, origin: "copiloto", payloads: [{ acao: "item", itemId: r.items.bruschetta!, mudanca: "preco", priceCents: 2700 }, { acao: "item", itemId: r.items.bruschetta!, mudanca: "fora_das_ofertas" }], now: NOW });
    await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: cards[0]!.id!, origin: "copiloto", acao: "aplicar", now: later(5000) });
    await decideProposal(getDb(), { restaurantId: r.restaurantId, proposalId: cards[1]!.id!, origin: "copiloto", acao: "descartar", now: later(6000) });
    const m = await getCopilotMetrics(getDb());
    expect(m).toMatchObject({ shown: 2, applied: 1, discarded: 1, appliedPct: 50 });
    expect(m.byAction).toEqual([{ action: "item", shown: 2, applied: 1 }]);
    expect(await appliedProposalTitle(getDb(), r.restaurantId, cards[0]!.id!.slice(0, 8))).toBe("Mudar o preço de “Bruschetta”");
    expect(await appliedProposalTitle(getDb(), r.restaurantId, "zzzz")).toBeNull();
  });
});

