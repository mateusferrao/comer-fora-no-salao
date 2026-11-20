/**
 * Spike da plataforma de IA (planejamento S0 §6.7): OpenRouter real + rastro aninhado no Langfuse.
 * Roda com `npx tsx scripts/spike-ai.ts`. Usa OPENROUTER_KEY_DEMO e LANGFUSE_*. Gasto esperado < US$ 0,01.
 * O `tsx` não carrega instrumentation.ts, então o script monta o próprio NodeSDK e o encerra no fim.
 */
import { z } from "zod";
import { systemClock } from "../src/shared/clock";
import { createOpenRouterGateway } from "../src/modules/ia/openrouter-gateway";
import { runTask, type TaskDef } from "../src/modules/ia/run-task";
import { langfuseTracer, setupTracing } from "../src/modules/ia/tracing";

const MODELS = [
  { id: "google/gemini-2.5-flash-lite", provider: "google", acceptsPdf: true },
  { id: "openai/gpt-5-nano", provider: "openai", acceptsPdf: true },
];

const schema = z.object({
  itens: z.array(z.object({ categoria: z.string(), nome: z.string(), precoCentavos: z.number().int().nonnegative() })),
});

// Cardápio fictício (nunca dados reais).
const CARDAPIO = `Entradas: Bolinho de mandioca R$ 24,00; Pastel de queijo R$ 18,50.
Pratos: Moqueca da casa R$ 79,90; Arroz de pato R$ 64,00.
Sobremesas: Pudim de leite R$ 16,00.`;

const SYSTEM = "Você extrai itens de cardápio. Responda só com o JSON pedido. Preço em centavos (inteiro).";

async function main() {
  const key = process.env.OPENROUTER_KEY_DEMO;
  if (!key) throw new Error("OPENROUTER_KEY_DEMO ausente");
  const tracing = setupTracing({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
    environment: "spike",
  });
  const ctx = { gateway: createOpenRouterGateway(key), clock: systemClock, trace: langfuseTracer };

  const base: TaskDef<z.infer<typeof schema>> = {
    name: "spike-extracao",
    promptVersion: "spike-v1",
    models: MODELS,
    schema,
    perAttemptTimeoutMs: 30_000,
    totalBudgetMs: 60_000,
  };

  // 1) Caminho feliz.
  const feliz = await runTask(base, SYSTEM, { text: CARDAPIO }, ctx);
  report("caminho feliz", feliz);

  // 2) Reserva forçada: o guard reprova a 1ª tentativa, o laço passa ao 2º modelo.
  let n = 0;
  const reserva = await runTask(
    {
      ...base,
      name: "spike-reserva",
      guard: () => (n++ === 0 ? { ok: false, reasons: ["reprovado de propósito no spike"] } : { ok: true }),
    },
    SYSTEM,
    { text: CARDAPIO },
    ctx,
  );
  report("reserva forçada", reserva);

  await tracing.shutdown();
}

function report(label: string, r: Awaited<ReturnType<typeof runTask>>) {
  const total = r.attempts.reduce((s, a) => s + (a.costUsd ?? 0), 0);
  console.log(`\n== ${label}: ${r.status}${r.status === "ok" ? ` (${r.model})` : ` (${r.reason})`}`);
  for (const a of r.attempts) {
    console.log(
      `   ${a.model} ok=${a.ok}${a.error ? ` erro=${a.error}` : ""} ${a.latencyMs} ms in=${a.inTokens ?? "?"} out=${a.outTokens ?? "?"} custo=US$ ${a.costUsd ?? "?"}`,
    );
  }
  if (r.status === "ok") console.log(`   itens: ${JSON.stringify(r.data)}`);
  console.log(`   custo total: US$ ${total.toFixed(6)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
