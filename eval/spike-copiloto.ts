/**
 * Spike da S8 (revisão técnica I5): saída estruturada achatada (`acao` enum + campos `nullable`) + 1 ferramenta +
 * conversa em vários turnos, nos 3 modelos da T4, via OpenRouter. Uso: OPENROUTER_KEY_DEMO=... npx tsx eval/spike-copiloto.ts
 */
import { z } from "zod";
import { createOpenRouterGateway } from "../src/modules/ia/openrouter-gateway";

const schema = z.object({
  resposta: z.string().max(600),
  propostas: z
    .array(
      z.object({
        acao: z.enum(["oferta", "item", "faixa"]),
        papel: z.enum(["agora", "recompensa", "convite"]).nullable(),
        faixa: z.enum(["F1", "F2"]).nullable(),
        prato: z.enum(["P1", "P2", "P3"]).nullable(),
        tipo: z.enum(["doce_gratis", "desconto"]).nullable(),
        pct: z.number().int().nullable(),
      }),
    )
    .max(3),
});

const MODELS = ["google/gemini-3.8-flash", "openai/gpt-6-luna", "anthropic/claude-haiku-5.5"];

async function main() {
  const gw = createOpenRouterGateway(process.env.OPENROUTER_KEY_DEMO!.replace(/^["'“”]|["'“”]$/g, ""));
  for (const id of MODELS) {
    const t0 = Date.now();
    try {
      const r = await gw.generate({
        model: { id, provider: id.split("/")[0]! },
        system:
          "Você é o assistente de um restaurante. Faixas: F1 = Ter, Qua e Qui 15h–18h (convite: P1); F2 = Seg a Qua 21h–23h. Pratos: P1 Cannoli (sobremesa), P2 Panna cotta (sobremesa), P3 Bruschetta (entrada). Responda sem números, citando {fato:chave}. Para mudanças, devolva propostas; nunca grave.",
        input: {
          messages: [
            { role: "user", text: "Como estão os convites?" },
            { role: "assistant", text: "Foram {fato:convites_usados} usados nesta semana." },
            { role: "user", text: "Troca a oferta do convite de terça à tarde pela panna cotta." },
          ],
        },
        schema,
        signal: AbortSignal.timeout(40_000),
        maxOutputTokens: 1500,
        tools: [{ name: "ver_numeros", description: "Números do restaurante, para citar com {fato:chave}.", input: z.object({}), execute: async () => ({ "{fato:convites_usados}": "12 convites" }) }],
        maxSteps: 3,
        privateTrace: true,
      });
      console.log(id, Date.now() - t0, "ms", JSON.stringify(r.output), "steps", r.steps?.length, "US$", r.usage.costUsd);
    } catch (e) {
      console.log(id, "FALHOU", Date.now() - t0, "ms", (e as Error).message);
    }
  }
}
void main();
