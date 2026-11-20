/**
 * Juiz de IA nos MESMOS pares do arquivo cego (eval/t3-cego.md), para medir a concordância com a nota humana
 * (D137). Lê o texto exato que o candidato vê; grava eval/t3-cego-juiz.json. Rodar:
 *   NODE_USE_ENV_PROXY=1 npx tsx eval/judge-t3-cego.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createOpenRouterGateway } from "@/src/modules/ia/openrouter-gateway";
import { cleanApiKey } from "@/src/modules/ia/gateway-factory";
import { noopTracer } from "@/src/modules/ia/gateway";
import { runTask } from "@/src/modules/ia/run-task";
import { systemClock } from "@/src/shared/clock";
import { FIXTURES } from "./fixtures-t3";
import { JUDGE, JUDGE_SYSTEM, judgeSchema } from "./judge-t3";

export type BlindPair = { n: number; title: string; A: string; B: string };

export function parseBlind(md: string): BlindPair[] {
  return md
    .split(/^## Par /m)
    .slice(1)
    .map((chunk) => {
      const n = Number(chunk.match(/^(\d+)/)![1]);
      const title = chunk.split("\n")[0]!.replace(/^\d+ — /, "").trim();
      const blocks = [...chunk.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1]!);
      return { n, title, A: blocks[0]!, B: blocks[1]! };
    });
}

async function main() {
  const key = cleanApiKey(process.env.OPENROUTER_KEY_DEMO);
  if (!key) throw new Error("OPENROUTER_KEY_DEMO ausente");
  const ctx = { gateway: createOpenRouterGateway(key), clock: systemClock, trace: noopTracer };
  const out: Array<{ n: number; pref: "A" | "B" | "empate"; motivo: string; costUsd: number }> = [];
  for (const p of parseBlind(readFileSync("eval/t3-cego.md", "utf8"))) {
    const f = FIXTURES.find((x) => p.title.startsWith(x.restaurantName))!;
    const text = `Restaurante: ${p.title}\nCardápio: ${f.menu.map((m) => `${m.name} (${m.category})`).join(", ")}\n\nProposta A:\n${p.A}\n\nProposta B:\n${p.B}`;
    const r = await runTask({ name: "juiz-t3", promptVersion: "juiz-t3-v1", models: [JUDGE], schema: judgeSchema, perAttemptTimeoutMs: 60_000, totalBudgetMs: 90_000, maxOutputTokens: 3_000 }, JUDGE_SYSTEM, { text }, ctx);
    const costUsd = r.attempts.reduce((a, x) => a + (x.costUsd ?? 0), 0);
    if (r.status !== "ok") {
      process.stdout.write(`par ${p.n}: juiz falhou\n`);
      continue;
    }
    out.push({ n: p.n, pref: r.data.preferencia, motivo: r.data.motivo, costUsd });
    process.stdout.write(`par ${p.n}: ${r.data.preferencia}\n`);
  }
  writeFileSync("eval/t3-cego-juiz.json", JSON.stringify({ judge: JUDGE.id, pairs: out }, null, 2));
}

if (process.argv[1]?.endsWith("judge-t3-cego.ts")) void main();
