import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb, getPool } from "@/src/db/client";
import { agentProposals, aiCalls, restaurants } from "@/src/db/schema";
import type { AiGateway, AiGenerateRequest } from "@/src/modules/ia/gateway";
import { runCopilotTurn } from "@/src/modules/agente/application/copilot-turn";
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
      "google/gemini-3.8-flash": () => ({ resposta: "Foram 12 convites.", propostas: [], sugestoes: [] }),
      "openai/gpt-6-luna": () => ({ resposta: "Foram {fato:checkins_30d} check-ins no último mês.", propostas: [], sugestoes: [] }),
    });
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "como foi o mês?" }], page: "painel", now: NOW, gateway: gw });
    expect(out.generatedBy).toBe("ia");
    expect(out.resposta).toMatch(/^Foram \d+ check-ins no último mês\.$/);
    expect(gw.calls).toHaveLength(2);
  });

  it("Tiramisù indisponível → cartão recusado com a regra do código", async () => {
    const r = await createRestaurant();
    const gw = scripted({ "*": (req) => ({ resposta: "Preparei a proposta abaixo.", propostas: [{ ...empty, acao: "item", prato: alias(req.system, "Tiramisù"), mudanca: "indisponivel" }], sugestoes: [] }) });
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "acabou o tiramisù" }], page: "configuracoes", now: NOW, gateway: gw });
    expect(out.propostas[0]).toMatchObject({ status: "recusada", motivo: "“Tiramisù” é a recompensa da cartela. Troque a recompensa antes de tirar o prato do cardápio." });
  });

  it("buscar_clientes nunca devolve contato (D262)", async () => {
    const r = await createRestaurant();
    let toolOut: unknown;
    const gw = scripted({
      "*": async (req) => {
        toolOut = await req.tools!.find((t) => t.name === "buscar_clientes")!.execute({ segmento: null, nome: null });
        return { resposta: "Veja os clientes.", propostas: [], sugestoes: [] };
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

  it("restaurante em rascunho → só dúvidas: prompt sem dados do restaurante e nenhuma proposta", async () => {
    const r = await createRestaurant();
    await getDb().update(restaurants).set({ status: "rascunho" }).where(eq(restaurants.id, r.restaurantId));
    const gw = scripted({ "*": () => ({ resposta: "O teto limita quantos convites saem por semana.", propostas: [], sugestoes: ["Preciso informar a margem?"] }) });
    const out = await runCopilotTurn(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, turns: [{ role: "user", text: "o que é o teto?" }], page: "ativar", now: NOW, gateway: gw });
    expect(out.generatedBy).toBe("ia");
    expect(out.propostas).toEqual([]);
    expect(gw.calls[0]!.system).not.toContain("CARDÁPIO");
    expect(gw.calls[0]!.system).not.toContain("Cantina de Teste");
    expect(out.resposta).toBe("O teto limita quantos convites saem por semana.");
  });
});
