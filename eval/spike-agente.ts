/**
 * Spike da S6.3b (≤ 1 h): os modelos do pacote aceitam `tools` + `output` (saída estruturada) juntos pelo OpenRouter
 * com `require_parameters`? Roda à mão: OPENROUTER_KEY_DEMO=... npx tsx eval/spike-agente.ts
 */
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output, stepCountIs, tool } from "ai";
import { z } from "zod";
import { cleanApiKey } from "@/src/modules/ia/gateway-factory";
import { MODELS } from "@/src/modules/ia/models";

const key = cleanApiKey(process.env.OPENROUTER_KEY_DEMO);
const openrouter = createOpenRouter({ apiKey: key, compatibility: "strict" });
const tools = {
  ver_candidatas: tool({
    description: "Lista as ofertas candidatas de uma faixa (horário vazio).",
    inputSchema: z.object({ faixa: z.enum(["A"]) }),
    execute: async () => ({ faixa: "A", horario: "terça a quinta, 15h às 18h", candidatas: [{ id: "A1", oferta: "Cannoli grátis", categoria: "sobremesa" }, { id: "A2", oferta: "Fritto misto grátis", categoria: "porção" }] }),
  }),
  ver_fatos: tool({
    description: "Fatos do restaurante de um grupo.",
    inputSchema: z.object({ grupo: z.enum(["turnos", "convites"]) }),
    execute: async ({ grupo }) => (grupo === "turnos" ? { "{fato:faixa_A_turno}": "tarde" } : { "{fato:uso7d_A_pct}": "30%" }),
  }),
};
const schema = z.object({ candidata: z.enum(["A1", "A2"]), justificativa: z.string() });

for (const m of MODELS.pacote) {
  const t0 = Date.now();
  try {
    const r = await generateText({
      model: openrouter(m.id, { usage: { include: true }, provider: { require_parameters: true, data_collection: "deny", ...(m.sort ? { sort: m.sort } : {}) }, ...(m.reasoningEffort ? { reasoning: { effort: m.reasoningEffort, exclude: true } } : {}) }),
      system: "Você escolhe a melhor oferta para o horário vazio de um restaurante. Consulte as ferramentas antes de responder. Responda no formato pedido.",
      prompt: "Faixa A. Use ver_candidatas e ver_fatos e escolha uma candidata.",
      tools,
      stopWhen: stepCountIs(4),
      prepareStep: ({ stepNumber }) => (stepNumber >= 3 ? { activeTools: [], toolChoice: "none" as const } : { toolChoice: "auto" as const }),
      output: Output.object({ schema }),
      maxRetries: 0,
      timeout: { totalMs: 30_000, stepMs: 12_000 },
    });
    const cost = r.steps.reduce((s, st) => s + (((st.providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost) ?? 0), 0);
    console.log(JSON.stringify({ model: m.id, ok: true, ms: Date.now() - t0, steps: r.steps.length, calls: r.steps.flatMap((s) => s.toolCalls.map((c) => c.toolName)), output: r.output, cost }));
  } catch (e) {
    console.log(JSON.stringify({ model: m.id, ok: false, ms: Date.now() - t0, err: (e as Error).name + ": " + (e as Error).message.slice(0, 300) }));
  }
}
