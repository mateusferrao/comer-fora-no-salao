import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCopilotPrompt, buildCopilotTask, buildOnboardingPrompt, copilotSchema, outputGate, OUT_OF_SCOPE_ANSWER, scopeCheck, toPayload, type CopilotInput, type CopilotOut } from "@/src/modules/ia/tasks/copilot";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { noopTracer } from "@/src/modules/ia/gateway";
import { runTask } from "@/src/modules/ia/run-task";
import { systemClock } from "@/src/shared/clock";
import type { Snapshot } from "@/src/modules/agente/domain/proposals";

// Assistente restrito ao escopo (S9, item 17): classificação da IA + portão determinístico do código.
const empty = { papel: null, faixa: null, prato: null, tipo: null, pct: null, teto: null, texto: null, mudanca: null, preco_centavos: null, dias: null, inicio: null, fim: null, intensidade: null, mesas: null, tom: null, nome: null, categoria: null, ticket_centavos: null, margem_pct: null, resumo_ligado: null, dia_semana: null, hora: null };
const out = (o: Partial<CopilotOut>): CopilotOut => ({ escopo: "salao", resposta: "", propostas: [], sugestoes: [], ...o });

describe("schema e prompt do escopo", () => {
  it("escopo é o 1º campo, no copiloto e na ativação", () => {
    const op = copilotSchema({ itemAliases: ["P1"], slotAliasList: ["A"] });
    expect(Object.keys(op.shape)[0]).toBe("escopo");
    expect(op.shape.escopo.options).toEqual(["salao", "fora"]);
    const onb = buildOnboardingPrompt("ativar");
    expect(Object.keys(copilotSchema(onb).shape)[0]).toBe("escopo");
    expect(onb.system).toMatch(/"fora"/);
  });
  it("saída sem escopo é inválida", () => {
    const s = copilotSchema({ itemAliases: ["P1"], slotAliasList: ["A"] });
    expect(s.safeParse({ resposta: "x", propostas: [], sugestoes: [] }).success).toBe(false);
  });
});

describe("portão de saída (vale qualquer que seja a classificação)", () => {
  it("resposta ancorada no produto passa", () => {
    expect(outputGate("Preparei a proposta abaixo para {horario:A}.")).toBeNull();
    expect(outputGate("Uma parte dos clientes não recebe convite.")).toBeNull();
    expect(outputGate("Foram {fato:checkins_30d} no último mês.")).toBeNull();
  });
  it("sem âncora (nem referência nem termo do produto) → sem_ancora", () => {
    expect(outputGate("Claro! Aqui vai uma ideia bonita para você.")).toBe("sem_ancora");
    expect(outputGate("A seleção ganhou a Copa.")).toBe("sem_ancora");
  });
  it("mais de 2 quebras de linha → linhas", () => {
    expect(outputGate("Lasanha no prato,\nqueijo a derreter,\nno salão a sorrir,\nquem há de esquecer")).toBe("linhas");
  });
  it("mais de 3 frases → frases (iniciais de nome não contam)", () => {
    expect(outputGate("O convite vale. O teto protege. O cliente volta. A mesa enche.")).toBe("frases");
    expect(outputGate("Ana S. e Carla T. estão perto da recompensa.")).toBeNull();
  });
  it("cara de código → codigo", () => {
    expect(outputGate("Use `print` no cardápio")).toBe("codigo");
    expect(outputGate("def cardapio(): return prato")).toBe("codigo");
    expect(outputGate("const f = () => cardapio")).toBe("codigo");
    expect(outputGate("convite; oferta; prato")).toBe("codigo");
  });
  it("léxico sem acento e no plural", () => {
    expect(outputGate("Os horarios e as configurações ficam na aba certa.")).toBeNull();
  });
});

describe("scopeCheck: o que o dono vê", () => {
  it("escopo 'fora' → recusa (motivo classificacao)", () => {
    expect(scopeCheck(out({ escopo: "fora", resposta: "Desculpe, não posso." }))).toEqual({ fora: true, motivo: "classificacao" });
  });
  it("resposta sem âncora → recusa, mesmo com escopo 'salao'", () => {
    expect(scopeCheck(out({ resposta: "Aqui vai um poema bonito sobre o amor." }))).toEqual({ fora: true, motivo: "resposta:sem_ancora" });
  });
  it("sugestão que não passa no portão some; as outras ficam", () => {
    expect(scopeCheck(out({ resposta: "Preparei a proposta abaixo.", sugestoes: ["Mudar o teto desse horário", "Escrever um poema bonito"] }))).toEqual({ fora: false, sugestoes: ["Mudar o teto desse horário"], descartadas: 1 });
  });
});

describe("as 62 respostas reais da T4 passam no portão (0 falso positivo)", () => {
  const rows = ["eval/resultados-t4.json", "eval/resultados-t4-validacao.json"].flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { rows: Array<{ id: string; resposta: string }> }).rows).filter((r) => r.resposta);
  it("são 62", () => expect(rows).toHaveLength(62));
  it.each(rows.map((r) => [r.id, r.resposta]))("%s", (_id, resposta) => {
    expect(outputGate(resposta)).toBeNull();
  });
});

// Turno com IA falsa (sem banco): o mesmo caminho do eval da T4.
const snap: Snapshot = {
  marginPct: 60,
  opening: [{ days: [0, 1, 2, 3, 4, 5, 6], startMin: 660, endMin: 1440 }],
  agora: { kind: "doce_gratis", itemId: "panna" },
  recompensa: { kind: "doce_gratis", itemId: "tiramisu" },
  slots: [{ id: "slotA", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 2, offer: { kind: "doce_gratis", itemId: "cannoli" }, weeklyCap: 8, inviteText: "Volte {horario:slotA} e aproveite {oferta}." }],
  menu: [
    { id: "lasanha", name: "Lasanha", category: "prato", priceCents: 5800, active: true, inUse: false, offerAllowed: true },
    { id: "panna", name: "Panna cotta", category: "sobremesa", priceCents: 1800, active: true, inUse: true, offerAllowed: true },
    { id: "cannoli", name: "Cannoli", category: "sobremesa", priceCents: 2200, active: true, inUse: true, offerAllowed: true },
    { id: "tiramisu", name: "Tiramisù", category: "sobremesa", priceCents: 2600, active: true, inUse: true, offerAllowed: true },
  ],
};
const input: CopilotInput = { restaurantName: "Cantina", snap, facts: { checkins_30d: 80 }, slotAliases: [{ alias: "A", slotId: "slotA" }], customers: [], plan: null, page: "configuracoes" };
const fake = (output: unknown): AiGateway => ({ async generate(req) { return { output, usage: { inTokens: 1, outTokens: 1, costUsd: 0 }, model: req.model.id, steps: [] }; } });
async function turn(output: unknown) {
  const cp = buildCopilotPrompt(input);
  const res = await runTask(buildCopilotTask(cp, [{ id: "x/m", provider: "x" }], []), cp.system, { messages: [{ role: "user", text: "pedido" }] }, { gateway: fake(output), clock: systemClock, trace: noopTracer });
  if (res.status !== "ok") throw new Error("falhou");
  return { cp, data: res.data, scope: scopeCheck(res.data) };
}

describe("turno com IA falsa (S9, item 17)", () => {
  it("poema sobre a lasanha (IA classifica 'fora') → recusa fixa do código", async () => {
    const { scope } = await turn({ escopo: "fora", resposta: "Posso sim! Lasanha dourada...", propostas: [], sugestoes: [] });
    expect(scope.fora).toBe(true);
    expect(OUT_OF_SCOPE_ANSWER).toBe("Eu só ajudo com o seu salão no Comer Fora: ofertas, cardápio, horários vazios, clientes e números. O que você quer ajustar?");
  });
  it("poema que a IA chamou de 'salao' → o portão recusa (linhas)", async () => {
    const { scope } = await turn({ escopo: "salao", resposta: "Lasanha dourada,\nno prato a brilhar,\nqueijo e molho,\nvem me abraçar", propostas: [], sugestoes: [] });
    expect(scope).toEqual({ fora: true, motivo: "resposta:linhas" });
  });
  it("resposta sem âncora → recusa fixa", async () => {
    const { scope } = await turn({ escopo: "salao", resposta: "A Argentina ganhou a última Copa.", propostas: [], sugestoes: [] });
    expect(scope).toEqual({ fora: true, motivo: "resposta:sem_ancora" });
  });
  it("'deixa o texto do convite mais poético' continua gerando proposta", async () => {
    const { cp, data, scope } = await turn({
      escopo: "salao",
      resposta: "Preparei a proposta abaixo com um texto mais poético para o convite de {horario:A}.",
      propostas: [{ ...empty, acao: "oferta", papel: "convite", faixa: "A", texto: "Quando a tarde desacelera, volte {horario:A} e aproveite {oferta}." }],
      sugestoes: ["Mudar o teto desse horário"],
    });
    expect(scope).toEqual({ fora: false, sugestoes: ["Mudar o teto desse horário"], descartadas: 0 });
    expect(toPayload(cp, data.propostas[0]!)).toMatchObject({ acao: "oferta", papel: "convite", slotId: "slotA", inviteText: "Quando a tarde desacelera, volte {horario:slotA} e aproveite {oferta}." });
  });
});
