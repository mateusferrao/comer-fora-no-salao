/**
 * T4 (S8 — D266): mini-avaliação do copiloto. 12 pedidos com gabarito sobre um retrato da Cantina (o mesmo do seed:
 * Tiramisù é a recompensa, faixa A = Ter–Qui 15h–18h, faixa B = Seg–Qua 21h–23h, sem horário no sábado) × 3 modelos
 * × 1 repetição, cada modelo sozinho (sem reserva). Mede: ação e parâmetros certos, regras do guard ok (resposta sem
 * número cru, contato ou link), latência p50 e custo. Regra fixada antes: maior acerto; empate → menor p50; p50 > 12 s
 * → o copiloto sai da demo. Uso: OPENROUTER_KEY_DEMO=... npx tsx eval/run-t4.ts
 */
import { writeFileSync } from "node:fs";
import { createOpenRouterGateway } from "../src/modules/ia/openrouter-gateway";
import { runTask } from "../src/modules/ia/run-task";
import { noopTracer, type ModelRef } from "../src/modules/ia/gateway";
import { systemClock } from "../src/shared/clock";
import { buildCopilotPrompt, buildCopilotTask, buildCopilotTools, toPayload, type CopilotInput, type CopilotOut } from "../src/modules/ia/tasks/copilot";
import type { ProposalPayload, Snapshot } from "../src/modules/agente/domain/proposals";

const MODELS: ModelRef[] = [
  { id: "google/gemini-3.8-flash", provider: "google", sort: "latency", reasoningEffort: "low" },
  { id: "openai/gpt-6-luna", provider: "openai", sort: "latency", reasoningEffort: "none" },
  { id: "anthropic/claude-haiku-5.5", provider: "anthropic", sort: "latency" },
];

const snap: Snapshot = {
  marginPct: 60,
  opening: [{ days: [0, 1, 2, 3, 4, 5, 6], startMin: 11 * 60, endMin: 24 * 60 }],
  agora: { kind: "doce_gratis", itemId: "panna" },
  recompensa: { kind: "doce_gratis", itemId: "tiramisu" },
  slots: [
    { id: "slotA", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 2, offer: { kind: "doce_gratis", itemId: "cannoli" }, weeklyCap: 8, inviteText: "Volte {horario:slotA} e aproveite {oferta}." },
    { id: "slotB", days: [1, 2, 3], startMin: 1260, endMin: 1380, intensity: "um_pouco", extraTables: 1, offer: { kind: "entrada_gratis", itemId: "bruschetta" }, weeklyCap: 4, inviteText: "" },
  ],
  menu: [
    { id: "bruschetta", name: "Bruschetta", category: "entrada", priceCents: 2400, active: true, inUse: true, offerAllowed: true },
    { id: "lasanha", name: "Lasanha à bolonhesa", category: "prato", priceCents: 5800, active: true, inUse: false, offerAllowed: true },
    { id: "nhoque", name: "Nhoque ao sugo", category: "prato", priceCents: 5200, active: true, inUse: false, offerAllowed: true },
    { id: "panna", name: "Panna cotta", category: "sobremesa", priceCents: 1800, active: true, inUse: true, offerAllowed: true },
    { id: "cannoli", name: "Cannoli", category: "sobremesa", priceCents: 2200, active: true, inUse: true, offerAllowed: true },
    { id: "tiramisu", name: "Tiramisù", category: "sobremesa", priceCents: 2600, active: true, inUse: true, offerAllowed: true },
    { id: "gelato", name: "Gelato artesanal", category: "sobremesa", priceCents: 1600, active: true, inUse: false, offerAllowed: true },
    { id: "soda", name: "Soda italiana", category: "bebida", priceCents: 1600, active: true, inUse: false, offerAllowed: true },
  ],
};
const input: CopilotInput = {
  restaurantName: "Cantina Nonna Lúcia",
  snap,
  facts: { checkins_30d: 812, clientes_30d: 540, uso7d_A_pct: 38, convites7d_A: 61, uso7d_B_pct: 22, convites7d_B: 27, segmento_sumiu: 120, segmento_perto: 34, segmento_frequente: 58, ticket_medio: 7800, margem_pct: 60 },
  slotAliases: [
    { alias: "A", slotId: "slotA" },
    { alias: "B", slotId: "slotB" },
  ],
  customers: [
    { alias: "C1", name: "Ana S.", visits: 5, stamps: 5, lastDay: "2026-11-20", segments: ["perto", "frequente"] },
    { alias: "C2", name: "Bruno M.", visits: 1, stamps: 1, lastDay: "2026-10-30", segments: ["sumiu"] },
    { alias: "C3", name: "Carla T.", visits: 5, stamps: 5, lastDay: "2026-11-18", segments: ["perto"] },
  ],
  plan: null,
  page: "configuracoes",
};

type Expect = (props: ProposalPayload[]) => boolean;
const none: Expect = (p) => p.length === 0;
const CASES: Array<{ id: string; ask: string; ok: Expect }> = [
  { id: "trocar_oferta", ask: "troca a oferta do convite de terça à tarde pelo gelato", ok: (p) => p.some((x) => x.acao === "oferta" && x.papel === "convite" && x.slotId === "slotA" && x.offer.itemId === "gelato") },
  { id: "acabou_tiramisu", ask: "acabou o tiramisù", ok: (p) => p.some((x) => x.acao === "item" && x.itemId === "tiramisu" && x.mudanca === "indisponivel") || none(p) },
  { id: "teto", ask: "aumenta o teto do convite da tarde para 12", ok: (p) => p.some((x) => x.acao === "oferta" && x.slotId === "slotA" && x.weeklyCap === 12) },
  { id: "preco", ask: "a lasanha agora custa 62 reais", ok: (p) => p.some((x) => x.acao === "item" && x.itemId === "lasanha" && x.mudanca === "preco" && x.priceCents === 6200) },
  { id: "fora_ofertas", ask: "não quero mais a soda italiana em nenhuma promoção", ok: (p) => p.some((x) => x.acao === "item" && x.itemId === "soda" && x.mudanca === "fora_das_ofertas") },
  { id: "faixa_fim", ask: "o horário vazio da tarde agora vai até as 19h", ok: (p) => p.some((x) => x.acao === "faixa" && x.slotId === "slotA" && x.mudanca === "editar" && x.endMin === 19 * 60) },
  { id: "desativar", ask: "pode parar o convite da noite, encheu", ok: (p) => p.some((x) => x.acao === "faixa" && x.slotId === "slotB" && x.mudanca === "desativar") },
  { id: "sabado", ask: "aumenta o teto do convite de sábado", ok: none },
  { id: "pergunta_numeros", ask: "como foram os convites nesta semana?", ok: none },
  { id: "pergunta_regra", ask: "o que é o grupo de controle?", ok: none },
  { id: "clientes", ask: "quem está perto da recompensa?", ok: none },
  { id: "desconto_60", ask: "coloca um desconto de 60% na lasanha no convite da noite", ok: (p) => none(p) || p.some((x) => x.acao === "oferta" && x.slotId === "slotB" && x.offer.itemId === "lasanha" && x.offer.kind === "desconto") },
];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};

async function main() {
  const key = (process.env.OPENROUTER_KEY_DEMO ?? "").replace(/^["'“”]|["'“”]$/g, "");
  const gateway = createOpenRouterGateway(key);
  const cp = buildCopilotPrompt(input);
  const tools = buildCopilotTools(input);
  const rows: Array<{ model: string; id: string; rulesOk: boolean; right: boolean; ms: number; cost: number; resposta: string; propostas: unknown; reasons?: string }> = [];
  for (const model of MODELS) {
    for (const c of CASES) {
      const task = { ...buildCopilotTask(cp, [model], tools), privateTrace: true };
      const t0 = Date.now();
      let res = await runTask(task, cp.system, { messages: [{ role: "user", text: c.ask }] }, { gateway, clock: systemClock, trace: noopTracer });
      // 429: espera e tenta de novo (não conta como erro do modelo).
      for (let k = 0; k < 2 && res.status !== "ok" && res.attempts.some((a) => a.detail?.includes("429")); k++) {
        await new Promise((r) => setTimeout(r, 10_000));
        res = await runTask(task, cp.system, { messages: [{ role: "user", text: c.ask }] }, { gateway, clock: systemClock, trace: noopTracer });
      }
      const ms = Date.now() - t0;
      const cost = res.attempts.reduce((a, x) => a + (x.costUsd ?? 0), 0);
      const ok = res.status === "ok";
      const data = res.status === "ok" ? (res.data as CopilotOut) : null;
      const payloads = data ? data.propostas.map((x) => toPayload(cp, x)).filter((x): x is ProposalPayload => !("erro" in x)) : [];
      const right = ok && c.ok(payloads);
      rows.push({ model: model.id, id: c.id, rulesOk: ok, right, ms, cost, resposta: data?.resposta ?? "", propostas: payloads, reasons: ok ? undefined : res.attempts.map((a) => `${a.error}:${(a.notes ?? []).join("|")}`).join("; ") });
      console.log(model.id, c.id, ok ? "ok" : "FALHA", right ? "certo" : "errado", `${ms} ms`, `US$ ${cost.toFixed(4)}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  const summary = MODELS.map((m) => {
    const r = rows.filter((x) => x.model === m.id);
    return { model: m.id, acerto: r.filter((x) => x.right).length, regras: r.filter((x) => x.rulesOk).length, p50: median(r.map((x) => x.ms)), custo: r.reduce((a, x) => a + x.cost, 0) };
  });
  const ranked = [...summary].sort((a, b) => b.acerto - a.acerto || a.p50 - b.p50);
  const md = [
    "# T4 — mini-avaliação do copiloto (S8, D266)",
    "",
    "12 pedidos com gabarito sobre um retrato da Cantina × 3 modelos × 1 repetição, cada modelo sozinho. Regra fixada antes: maior acerto; empate → menor p50; p50 > 12 s → o copiloto sai da demo. Amostra pequena: resultado indicativo (\"teste de fumaça\").",
    "",
    "| Modelo | Acerto (de 12) | Regras ok (de 12) | p50 | Custo total |",
    "|---|---|---|---|---|",
    ...summary.map((s) => `| ${s.model} | ${s.acerto} | ${s.regras} | ${(s.p50 / 1000).toFixed(1)} s | US$ ${s.custo.toFixed(4)} |`),
    "",
    `**Vencedor pela regra:** ${ranked[0]!.model}; reserva: ${ranked.find((s) => s.model.split("/")[0] !== ranked[0]!.model.split("/")[0])?.model ?? ranked[1]!.model} (outro provedor).`,
    "",
    "## Casos",
    "",
    "| Caso | Pedido | " + MODELS.map((m) => m.id.split("/")[1]).join(" | ") + " |",
    "|---|---|" + MODELS.map(() => "---").join("|") + "|",
    ...CASES.map((c) => `| ${c.id} | ${c.ask} | ` + MODELS.map((m) => {
      const r = rows.find((x) => x.model === m.id && x.id === c.id)!;
      return `${r.right ? "✓" : "✗"}${r.rulesOk ? "" : " (regras)"} ${(r.ms / 1000).toFixed(1)} s`;
    }).join(" | ") + " |"),
    "",
    "Conflito declarado: o assistente que construiu o produto é da Anthropic; o `claude-haiku-5.5` concorre e a regra é numérica, fixada antes.",
  ].join("\n");
  writeFileSync("eval/relatorio-t4.md", md + "\n");
  writeFileSync("eval/resultados-t4.json", JSON.stringify({ summary, rows }, null, 2));
  console.log(md);
}
void main();
