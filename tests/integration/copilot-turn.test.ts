import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb, getPool } from "@/src/db/client";
import { agentProposals, aiCalls, restaurants } from "@/src/db/schema";
import type { AiGateway, AiGenerateRequest } from "@/src/modules/ia/gateway";
import { runCopilotTurn } from "@/src/modules/agente/application/copilot-turn";
import { getCopilotMetrics } from "@/src/modules/agente/application/metrics";
import { FORMAT_FALLBACK_ANSWER, FORMAT_FALLBACK_WITH_PROPOSAL, OUT_OF_SCOPE_ANSWER, OUT_OF_SCOPE_SUGGESTIONS } from "@/src/modules/ia/tasks/copilot";
import { createRestaurant, resetDb } from "./helpers/db";

const NOW = new Date("2026-11-23T16:00:00Z");
const alias = (system: string, name: string) => new RegExp(`- (P\\d+): ${name} `).exec(system)![1]!;
const empty = { papel: null, faixa: null, prato: null, tipo: null, pct: null, teto: null, texto: null, mudanca: null, preco_centavos: null, dias: null, inicio: null, fim: null, intensidade: null, mesas: null, tom: null, nome: null, categoria: null, ticket_centavos: null, margem_pct: null, resumo_ligado: null, dia_semana: null, hora: null };

/** Gateway roteirizado: por modelo, uma função que recebe o pedido e devolve a saída (pode chamar ferramentas). */
function scripted(byModel: Record<string, (req: AiGenerateRequest) => Promise<unknown> | unknown>): AiGateway & { calls: AiGenerateRequest[] } {
  const calls: AiGenerateRequest[] = [];
  return {
    calls,
    async generate(req) {
      calls.push(req);
      const f = byModel[req.model.id] ?? byModel["*"];
      if (!f) throw new Error("sem roteiro");
      return { output: await f(req), usage: { inTokens: 10, outTokens: 10, costUsd: 0.001 }, model: req.model.id, steps: [] };
    },
  };
}

describe("turno do copiloto (S8)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("pedido de troca de oferta → resposta renderizada + cartão pendente; rastro privado e ai_calls", async () => {
    const r = await createRestaurant();
    const gw = scripted({
      "*": (req) => ({
        escopo: "salao",
        resposta: "Preparei a proposta abaixo para {horario:A}: troca para {prato:" + alias(req.system, "Bruschetta") + "}.",
        propostas: [{ ...empty, acao: "oferta", papel: "convite", faixa: "A", prato: alias(req.system, "Bruschetta"), tipo: "entrada_gratis" }],
        sugestoes: ["Mudar o teto desse horário"],
      }),
    });
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "troca a oferta de terça à tarde por bruschetta" }], page: "configuracoes", now: NOW, gateway: gw });
    expect(out.generatedBy).toBe("ia");
    expect(out.resposta).toBe("Preparei a proposta abaixo para terça, quarta e quinta, das 15h às 18h: troca para Bruschetta.");
    expect(out.propostas).toHaveLength(1);
    expect(out.propostas[0]).toMatchObject({ status: "pendente" });
    expect(gw.calls[0]!.privateTrace).toBe(true);
    expect("messages" in gw.calls[0]!.input).toBe(true);
    const [call] = await getDb().select().from(aiCalls).where(eq(aiCalls.task, "copiloto"));
    expect(call!.status).toBe("ok");
    const [prop] = await getDb().select().from(agentProposals);
    expect(prop!.aiCallId).toBe(call!.id);
  });

  it("orçamento de consultas: turno com proposta reaproveita o retrato (revisão S8, item 23)", async () => {
    const r = await createRestaurant();
    const gw = scripted({
      "*": (req) => ({
        escopo: "salao",
        resposta: "Preparei a proposta abaixo.",
        propostas: [{ ...empty, acao: "oferta", papel: "convite", faixa: "A", prato: alias(req.system, "Bruschetta"), tipo: "entrada_gratis" }],
        sugestoes: [],
      }),
    });
    const spy = vi.spyOn(getPool(), "query");
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "troca a oferta" }], page: "configuracoes", now: NOW, gateway: gw });
    const n = spy.mock.calls.length;
    expect(out.propostas[0]).toMatchObject({ status: "pendente" });
    spy.mockRestore();
    // Eram 29 (loadContext 3×); com um só contexto e o retrato reaproveitado, 19.
    expect(n).toBeLessThanOrEqual(20);
  });

  it("1º modelo escreve número cru → guard reprova → 2º modelo responde", async () => {
    const r = await createRestaurant();
    const gw = scripted({
      "google/gemini-3.8-flash": () => ({ escopo: "salao", resposta: "Foram 12 convites.", propostas: [], sugestoes: [] }),
      "openai/gpt-6-luna": () => ({ escopo: "salao", resposta: "Foram {fato:checkins_30d} check-ins no último mês.", propostas: [], sugestoes: [] }),
    });
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "como foi o mês?" }], page: "painel", now: NOW, gateway: gw });
    expect(out.generatedBy).toBe("ia");
    expect(out.resposta).toMatch(/^Foram \d+ check-ins no último mês\.$/);
    expect(gw.calls).toHaveLength(2);
  });

  it("Tiramisù indisponível → cartão recusado com a regra do código", async () => {
    const r = await createRestaurant();
    const gw = scripted({ "*": (req) => ({ escopo: "salao", resposta: "Preparei a proposta abaixo.", propostas: [{ ...empty, acao: "item", prato: alias(req.system, "Tiramisù"), mudanca: "indisponivel" }], sugestoes: [] }) });
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "acabou o tiramisù" }], page: "configuracoes", now: NOW, gateway: gw });
    expect(out.propostas[0]).toMatchObject({ status: "recusada", motivo: "“Tiramisù” é a recompensa da cartela. Troque a recompensa antes de tirar o prato do cardápio." });
  });

  it("buscar_clientes nunca devolve contato (D262)", async () => {
    const r = await createRestaurant();
    let toolOut: unknown;
    const gw = scripted({
      "*": async (req) => {
        toolOut = await req.tools!.find((t) => t.name === "buscar_clientes")!.execute({ segmento: null, nome: null });
        return { escopo: "salao", resposta: "Veja os clientes.", propostas: [], sugestoes: [] };
      },
    });
    await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "quem está perto da recompensa?" }], page: "clientes", now: NOW, gateway: gw });
    const json = JSON.stringify(toolOut);
    expect(json).not.toMatch(/@|\d{8,}/);
    expect(gw.calls[0]!.system).not.toMatch(/@[a-z]/);
  });

  it("sem IA (gateway nulo) → resposta fixa e atalhos para a aba certa", async () => {
    const r = await createRestaurant();
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "aumenta o teto do convite" }], page: "configuracoes", now: NOW, gateway: null });
    expect(out.generatedBy).toBe("sem_ia");
    expect(out.atalhos[0]).toEqual({ label: "Horários vazios e convites", href: "/parceiro/salao/configuracoes?aba=convites" });
  });

  it("fora do escopo (S9): poema → recusa fixa do código, sem proposta; a métrica conta (IA e portão)", async () => {
    const r = await createRestaurant();
    const poem = scripted({ "*": (req) => ({ escopo: "fora", resposta: "Lasanha dourada no forno...", propostas: [{ ...empty, acao: "item", prato: alias(req.system, "Tiramisù"), mudanca: "indisponivel" }], sugestoes: ["Outro poema"] }) });
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "escreve um poema sobre a lasanha" }], page: "painel", now: NOW, gateway: poem });
    expect(out).toMatchObject({ resposta: OUT_OF_SCOPE_ANSWER, propostas: [], sugestoes: OUT_OF_SCOPE_SUGGESTIONS, generatedBy: "ia", foraDoEscopo: true });
    expect(await getDb().select().from(agentProposals)).toEqual([]);
    // A IA disse "salão", mas a resposta não cita nada do produto: o portão do código recusa.
    const loose = scripted({ "*": () => ({ escopo: "salao", resposta: "A Argentina ganhou a última Copa.", propostas: [], sugestoes: [] }) });
    const out2 = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "quem ganhou a Copa?" }], page: "painel", now: NOW, gateway: loose });
    expect(out2.resposta).toBe(OUT_OF_SCOPE_ANSWER);
    const m = await getCopilotMetrics(getDb());
    expect(m.outOfScope).toEqual({ total: 2, byGate: 1 });
    expect(m.turns).toBe(2);
  });

  it("revisão S9: falha só de formato nos 2 modelos, com proposta válida → cartão fica e o texto é do código", async () => {
    const r = await createRestaurant();
    const long = (req: AiGenerateRequest) => ({
      escopo: "salao",
      resposta: "Preparei a proposta abaixo. O convite muda. O teto fica. A cartela segue.",
      propostas: [{ ...empty, acao: "oferta", papel: "convite", faixa: "A", prato: alias(req.system, "Bruschetta"), tipo: "entrada_gratis" }],
      sugestoes: ["Mudar o teto desse horário"],
    });
    const gw = scripted({ "*": long });
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "troca a oferta da tarde" }], page: "configuracoes", now: NOW, gateway: gw });
    expect(gw.calls).toHaveLength(2);
    expect(out).toMatchObject({ resposta: FORMAT_FALLBACK_WITH_PROPOSAL, generatedBy: "ia", sugestoes: ["Mudar o teto desse horário"] });
    expect(out.foraDoEscopo).toBeUndefined();
    expect(out.propostas).toHaveLength(1);
    expect(out.propostas[0]).toMatchObject({ status: "pendente" });
    const [call] = await getDb().select().from(aiCalls).where(eq(aiCalls.task, "copiloto"));
    expect(JSON.stringify(call!.attempts)).toContain("resposta_do_codigo");
    expect((await getCopilotMetrics(getDb())).outOfScope.total).toBe(0);
  });

  it("revisão S9: falha só de formato sem proposta → pede um pedido mais direto (não é a recusa de escopo)", async () => {
    const r = await createRestaurant();
    const gw = scripted({ "*": () => ({ escopo: "salao", resposta: "O convite vale,\no teto protege,\no cliente volta,\na cartela enche", propostas: [], sugestoes: [] }) });
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "me explica tudo" }], page: "painel", now: NOW, gateway: gw });
    expect(out).toMatchObject({ resposta: FORMAT_FALLBACK_ANSWER, propostas: [], generatedBy: "ia" });
    expect(out.foraDoEscopo).toBeUndefined();
  });

  it("revisão S9: o nome da casa com número por extenso não reprova a resposta", async () => {
    const r = await createRestaurant();
    await getDb().update(restaurants).set({ name: "Bar Dois Irmãos" }).where(eq(restaurants.id, r.restaurantId));
    const gw = scripted({ "*": () => ({ escopo: "salao", resposta: "O Bar Dois Irmãos teve {fato:checkins_30d} no último mês.", propostas: [], sugestoes: [] }) });
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "como foi o mês?" }], page: "painel", now: NOW, gateway: gw });
    expect(out.resposta).toMatch(/^O Bar Dois Irmãos teve \d+ check-ins? no último mês\.$/);
    expect(gw.calls).toHaveLength(1);
  });

  it("restaurante em rascunho → só dúvidas: prompt sem dados do restaurante e nenhuma proposta", async () => {
    const r = await createRestaurant();
    await getDb().update(restaurants).set({ status: "rascunho" }).where(eq(restaurants.id, r.restaurantId));
    const gw = scripted({ "*": () => ({ escopo: "salao", resposta: "O teto limita quantos convites saem por semana.", propostas: [], sugestoes: ["Preciso informar a margem?"] }) });
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "o que é o teto?" }], page: "ativar", now: NOW, gateway: gw });
    expect(out.generatedBy).toBe("ia");
    expect(out.propostas).toEqual([]);
    expect(gw.calls[0]!.system).not.toContain("CARDÁPIO");
    expect(gw.calls[0]!.system).not.toContain("Cantina de Teste");
    expect(out.resposta).toBe("O teto limita quantos convites saem por semana.");
  });
});
