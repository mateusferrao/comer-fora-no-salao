import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCopilotPrompt, buildCopilotTask, buildOnboardingPrompt, COPILOT_MAX_CHARS, COPILOT_PROMPT_VERSION, copilotGuard, copilotSchema, outputGate, OUT_OF_SCOPE_ANSWER, REF_MAX_CHARS, scopeCheck, toPayload, type CopilotInput, type CopilotOut } from "@/src/modules/ia/tasks/copilot";
import { T4_INPUT } from "@/eval/fixtures-t4";
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
  it("resposta ancorada no produto passa: 1 referência ou 2 termos do produto", () => {
    expect(outputGate("Preparei a proposta abaixo para {horario:A}.")).toBeNull();
    expect(outputGate("Uma parte dos clientes não recebe convite.")).toBeNull();
    expect(outputGate("Foram {fato:checkins_30d} no último mês.")).toBeNull();
  });
  it("1 termo só basta quando há proposta válida (o cartão é do código)", () => {
    expect(outputGate("Preparei a proposta abaixo.", { propostas: 1 })).toBeNull();
    expect(outputGate("Preparei a proposta abaixo.")).toBe("sem_ancora");
    // Pedido misto: a piada ao lado da proposta não passa (3 frases, 1 termo só).
    expect(outputGate("Preparei a proposta abaixo. E uma piada: por que o tomate corou? Viu a salada sem roupa.", { propostas: 1 })).toBe("sem_ancora");
  });
  it("sem âncora (nem referência nem termo do produto) → sem_ancora", () => {
    expect(outputGate("Claro! Aqui vai uma ideia bonita para você.")).toBe("sem_ancora");
    expect(outputGate("A seleção ganhou a Copa.")).toBe("sem_ancora");
  });
  it("termos genéricos (mesa, semana, texto, item, prato, sobremesa…) não ancoram", () => {
    expect(outputGate("Tom, o item da mesa é o prato da semana, com sobremesa, entrada e bebida no restaurante.")).toBe("sem_ancora");
  });
  it("mais de 2 quebras de linha → linhas", () => {
    expect(outputGate("Lasanha no prato,\nqueijo a derreter,\nno salão a sorrir,\nquem há de esquecer")).toBe("linhas");
  });
  it("mais de 3 frases → frases (iniciais de nome não contam)", () => {
    expect(outputGate("O convite vale. O teto protege. O cliente volta. A mesa enche.")).toBe("frases");
    expect(outputGate("Ana S. e Carla T. estão perto da recompensa da cartela.")).toBeNull();
  });
  it("frase com mais de 35 palavras → palavras", () => {
    const longa = `O convite do salão ${"e mais uma coisa ".repeat(9)}fim.`;
    expect(outputGate(longa)).toBe("palavras");
  });
  it(`resposta com mais de ${COPILOT_MAX_CHARS} caracteres renderizados → tamanho (cada referência conta até ${REF_MAX_CHARS})`, () => {
    expect(outputGate(`O convite e o teto. ${"a".repeat(COPILOT_MAX_CHARS)}`)).toBe("tamanho");
    const cp = buildCopilotPrompt({ ...input, snap: { ...snap, menu: snap.menu.map((m) => ({ ...m, name: m.name.padEnd(80, "x") })) } });
    // 3 referências a um prato de 80 letras: o nome é do código, conta até o limite de cada referência.
    expect(outputGate("Preparei a proposta abaixo com {prato:P1}, {prato:P1} e {prato:P1} para o convite.", { ctx: cp.ctx })).toBeNull();
  });
  it("cara de código → codigo", () => {
    expect(outputGate("Use `print` no cardápio")).toBe("codigo");
    expect(outputGate("def cardapio(): return prato")).toBe("codigo");
    expect(outputGate("const f = () => cardapio")).toBe("codigo");
    expect(outputGate("convite; oferta; prato")).toBe("codigo");
    expect(outputGate("SELECT nome, telefone FROM clientes WHERE convite = 1")).toBe("codigo");
    expect(outputGate("insert into ofertas values do convite")).toBe("codigo");
    expect(outputGate("update convites set teto do salão")).toBe("codigo");
    expect(outputGate("delete from clientes do convite")).toBe("codigo");
    expect(outputGate("import os para ler o cardápio do convite")).toBe("codigo");
    expect(outputGate("for p in cardapio: print(p) no convite")).toBe("codigo");
    expect(outputGate("O convite {oferta} do cardápio")).toBe("codigo");
    expect(outputGate("O convite do cardápio:\n    linha indentada")).toBe("codigo");
  });
  it("léxico sem acento e no plural", () => {
    expect(outputGate("Os convites e as cartelas ficam no painel.")).toBeNull();
    expect(outputGate("Os horarios vazios e o salao.")).toBeNull();
  });
});

describe("revisão S9: 8 textos fora do escopo que passavam no portão agora caem", () => {
  const SQL = "SELECT nome, telefone, email FROM clientes WHERE visitas > 3 ORDER BY nome";
  const PY = "for prato in cardapio:\n    print(prato.nome)\n    total += prato.preco";
  const LONG = `o restaurante fica cheio no fim de semana e a mesa da janela é a preferida de todos os clientes que chegam cedo para o almoço de domingo com a família inteira e pedem o prato do dia com sobremesa e café e depois ficam conversando até tarde sem pressa nenhuma porque o salão é tranquilo e o garçom conhece cada um pelo nome e sabe o que cada mesa costuma pedir quando o tempo está frio ou quando está calor e o cardápio muda conforme a estação do ano`;
  const textos: Array<[string, string]> = [
    ["poema de 3 linhas com 'mesa'", "Na mesa posta,\no vinho e o pão,\num brinde à vida"],
    ["texto corrido sem pontuação", LONG],
    ["SQL", SQL],
    ["Python sem def", PY],
    ["inglês com item/Tom/display", "Tom, the item on display is the best seller this week, enjoy it with friends."],
    ["espanhol com mesa", "La mesa está lista para la cena con amigos y familia."],
    ["receita com sobremesa", "Para a sobremesa, bata ovos com açúcar, junte o leite e leve ao forno até dourar."],
    ["capital da França", "A capital da França é Paris. Posso preparar outro texto para sua semana."],
  ];
  it("o texto corrido tem mais de 300 caracteres", () => expect(LONG.length).toBeGreaterThan(300));
  it.each(textos)("%s", (_nome, texto) => {
    expect(outputGate(texto)).not.toBeNull();
    expect(scopeCheck(out({ resposta: texto }))).toMatchObject({ fora: expect.any(Boolean) });
    const s = scopeCheck(out({ resposta: texto }));
    expect(s.fora || ("formato" in s && !!s.formato)).toBe(true);
  });
});

describe("scopeCheck: o que o dono vê", () => {
  it("escopo 'fora' → recusa (motivo classificacao)", () => {
    expect(scopeCheck(out({ escopo: "fora", resposta: "Desculpe, não posso." }))).toEqual({ fora: true, motivo: "classificacao" });
  });
  it("resposta sem âncora → recusa, mesmo com escopo 'salao'", () => {
    expect(scopeCheck(out({ resposta: "Aqui vai um poema bonito sobre o amor." }))).toEqual({ fora: true, motivo: "resposta:sem_ancora" });
  });
  it("falha só de formato → não é recusa: o turno troca o texto (formato)", () => {
    expect(scopeCheck(out({ resposta: "O convite vale. O teto protege. O cliente volta. A cartela enche." }))).toEqual({ fora: false, formato: "frases", sugestoes: [], descartadas: 0 });
  });
  it("sugestão sem nenhum termo do produto some; com 1 termo fica (são curtas)", () => {
    expect(scopeCheck(out({ resposta: "Preparei a proposta abaixo.", sugestoes: ["Mudar o teto desse horário", "Escrever um poema bonito", "Um poema sobre a mesa"] }), { propostas: 1 })).toEqual({ fora: false, sugestoes: ["Mudar o teto desse horário"], descartadas: 2 });
  });
});

describe("as 62 respostas reais da T4 (e as 'salão' da rodada de escopo) passam no portão (0 falso positivo)", () => {
  const cp = buildCopilotPrompt(T4_INPUT);
  type Row = { id: string; resposta: string; propostas?: unknown[]; escopo?: string };
  const read = (f: string) => (JSON.parse(readFileSync(f, "utf8")) as { rows: Row[] }).rows;
  const rows = ["eval/resultados-t4.json", "eval/resultados-t4-validacao.json"].flatMap(read).filter((r) => r.resposta);
  const escopo = read("eval/resultados-t4-escopo.json").filter((r) => r.resposta && r.escopo === "salao");
  it("são 62", () => expect(rows).toHaveLength(62));
  it.each([...rows, ...escopo].map((r) => [r.id, r.resposta, r.propostas?.length ?? 0] as const))("%s", (_id, resposta, propostas) => {
    expect(outputGate(resposta, { ctx: cp.ctx, propostas })).toBeNull();
  });
});

describe("copilotGuard (revisão S9): só falha de formato faz o runTask tentar de novo", () => {
  const cp = buildCopilotPrompt(T4_INPUT);
  it("formato reprova (outro modelo tenta); sem âncora não reprova (vira recusa no turno)", () => {
    expect(copilotGuard(cp)(out({ resposta: "Na mesa,\no vinho,\no pão,\na vida" }))).toEqual({ ok: false, reasons: ["resposta:formato:linhas"] });
    expect(copilotGuard(cp)(out({ resposta: "A Argentina ganhou a Copa." }))).toEqual({ ok: true });
    expect(copilotGuard(cp)(out({ escopo: "fora", resposta: "Na mesa,\no vinho,\no pão,\na vida" }))).toEqual({ ok: true });
  });
  it("guarda a última saída que falhou só no formato (para manter as propostas)", () => {
    const held: { last: CopilotOut | null } = { last: null };
    const bad = out({ resposta: "O convite vale. O teto protege. O cliente volta. A cartela enche." });
    copilotGuard(cp, held)(bad);
    expect(held.last).toBe(bad);
    const numero = out({ resposta: "Foram 12 convites. O teto protege. O cliente volta. A cartela enche." });
    copilotGuard(cp, held)(numero);
    expect(held.last).toBe(bad);
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
  const propostas = res.data.propostas.filter((p) => !("erro" in toPayload(cp, p))).length;
  return { cp, data: res.data, scope: scopeCheck(res.data, { ctx: cp.ctx, propostas }) };
}

describe("turno com IA falsa (S9, item 17)", () => {
  it("poema sobre a lasanha (IA classifica 'fora') → recusa fixa do código", async () => {
    const { scope } = await turn({ escopo: "fora", resposta: "Posso sim! Lasanha dourada...", propostas: [], sugestoes: [] });
    expect(scope.fora).toBe(true);
    expect(OUT_OF_SCOPE_ANSWER).toBe("Eu só ajudo com o seu salão no Comer Fora: ofertas, cardápio, horários vazios, clientes e números. O que você quer ajustar?");
  });
  it("poema que a IA chamou de 'salao' → o guard reprova o formato (o runTask tenta outro modelo)", async () => {
    const cp = buildCopilotPrompt(input);
    const held: { last: CopilotOut | null } = { last: null };
    const poem = { escopo: "salao", resposta: "Lasanha dourada,\nno prato a brilhar,\nqueijo e molho,\nvem me abraçar", propostas: [], sugestoes: [] };
    const res = await runTask(buildCopilotTask(cp, [{ id: "x/m", provider: "x" }], [], undefined, held), cp.system, { messages: [{ role: "user", text: "pedido" }] }, { gateway: fake(poem), clock: systemClock, trace: noopTracer });
    expect(res.status).toBe("fallback");
    expect(held.last).toEqual(poem);
    expect(scopeCheck(held.last!, { ctx: cp.ctx })).toEqual({ fora: false, formato: "linhas", sugestoes: [], descartadas: 0 });
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
    expect(COPILOT_PROMPT_VERSION).toBe("copiloto-v5");
    expect(toPayload(cp, data.propostas[0]!)).toMatchObject({ acao: "oferta", papel: "convite", slotId: "slotA", inviteText: "Quando a tarde desacelera, volte {horario:slotA} e aproveite {oferta}." });
  });
});
