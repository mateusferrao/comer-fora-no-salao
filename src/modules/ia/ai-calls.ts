/** Resumo de cada chamada de IA em `ai_calls` (sem conteúdo nem PII — espec. 4.8) e teto diário da chave pública. */
import { and, eq, gte, sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { aiCalls } from "@/src/db/schema";
import { endOfDaySP } from "@/src/shared/tz";
import type { TaskResult } from "./run-task";

export type KeyKind = "publica" | "demo";
/** Teto diário da chave pública [C] (US$): acima disso, as tarefas caem no modo sem IA, com aviso. */
export const PUBLIC_DAILY_CAP_USD = 0.5;

export async function recordAiCall(ex: Executor, p: { task: string; promptVersion: string; restaurantId?: string | null; result: TaskResult<unknown>; keyKind: KeyKind; at?: Date }): Promise<void> {
  const a = p.result.attempts;
  const sum = (f: (x: (typeof a)[number]) => number | undefined) => a.reduce((acc, x) => acc + (f(x) ?? 0), 0);
  try {
    await ex.insert(aiCalls).values({
      task: p.task,
      promptVersion: p.promptVersion,
      restaurantId: p.restaurantId ?? null,
      status: p.result.status,
      reason: p.result.status === "fallback" ? p.result.reason : null,
      model: p.result.status === "ok" ? p.result.model : null,
      servedModel: a.at(-1)?.servedModel ?? null,
      inTokens: sum((x) => x.inTokens),
      outTokens: sum((x) => x.outTokens),
      costUsd: String(sum((x) => x.costUsd)),
      latencyMs: sum((x) => x.latencyMs),
      attempts: a.map((x) => ({ model: x.model, ok: x.ok, error: x.error ?? null, notes: x.notes ?? [], latencyMs: x.latencyMs, costUsd: x.costUsd ?? null })),
      keyKind: p.keyKind,
      at: p.at ?? new Date(),
    });
  } catch {
    // O resumo nunca derruba a requisição (espec. 4.8).
  }
}

/** Gasto do dia (SP) numa chave, somado de `ai_calls`. */
export async function spentToday(ex: Executor, keyKind: KeyKind, now: Date): Promise<number> {
  const start = new Date(endOfDaySP(now).getTime() - 86_400_000 + 1);
  const [r] = await ex
    .select({ total: sql<string>`coalesce(sum(${aiCalls.costUsd}), 0)` })
    .from(aiCalls)
    .where(and(eq(aiCalls.keyKind, keyKind), gte(aiCalls.at, start)));
  return Number(r?.total ?? 0);
}
