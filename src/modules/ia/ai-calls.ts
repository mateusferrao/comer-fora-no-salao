/** Resumo de cada chamada de IA em `ai_calls` (sem conteúdo nem PII — espec. 4.8) e teto diário da chave pública. */
import { and, eq, gte, sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { aiCalls } from "@/src/db/schema";
import { endOfDaySP } from "@/src/shared/tz";
import type { TaskResult } from "./run-task";

export type KeyKind = "publica" | "demo";
/** Teto diário da chave pública [C] (US$): acima disso, as tarefas caem no modo sem IA, com aviso. */
export const PUBLIC_DAILY_CAP_USD = 0.5;

/**
 * `notes`: marcas do código sobre o resultado (ex.: `fora_do_escopo` no copiloto — S9), somadas às notas da última
 * tentativa; servem às métricas sem gravar conteúdo.
 */
export async function recordAiCall(ex: Executor, p: { task: string; promptVersion: string; restaurantId?: string | null; planId?: string | null; result: TaskResult<unknown>; keyKind: KeyKind; at?: Date; notes?: string[] }): Promise<string | null> {
  const a = p.result.attempts;
  const last = a.length - 1;
  const sum = (f: (x: (typeof a)[number]) => number | undefined) => a.reduce((acc, x) => acc + (f(x) ?? 0), 0);
  try {
    const [row] = await ex.insert(aiCalls).values({
      task: p.task,
      promptVersion: p.promptVersion,
      restaurantId: p.restaurantId ?? null,
      planId: p.planId ?? null,
      status: p.result.status,
      reason: p.result.status === "fallback" ? p.result.reason : null,
      model: p.result.status === "ok" ? p.result.model : null,
      servedModel: a.at(-1)?.servedModel ?? null,
      inTokens: sum((x) => x.inTokens),
      outTokens: sum((x) => x.outTokens),
      costUsd: String(sum((x) => x.costUsd)),
      latencyMs: sum((x) => x.latencyMs),
      attempts: a.map((x, i) => ({ model: x.model, ok: x.ok, error: x.error ?? null, notes: [...(x.notes ?? []), ...(i === last ? (p.notes ?? []) : [])], latencyMs: x.latencyMs, costUsd: x.costUsd ?? null })),
      keyKind: p.keyKind,
      at: p.at ?? new Date(),
    }).returning({ id: aiCalls.id });
    // S8: o id liga a proposta do copiloto à chamada que a gerou.
    return row?.id ?? null;
  } catch {
    // O resumo nunca derruba a requisição (espec. 4.8).
    return null;
  }
}

/** Teto diário próprio do copiloto na chave pública (S8, D271): não derruba plano e kit para o modo sem IA. */
export const COPILOT_PUBLIC_DAILY_CAP_USD = 0.2;

/** Gasto do dia (SP) numa chave, somado de `ai_calls` (com `task`, só o daquela tarefa). */
export async function spentToday(ex: Executor, keyKind: KeyKind, now: Date, task?: string): Promise<number> {
  const start = new Date(endOfDaySP(now).getTime() - 86_400_000 + 1);
  const [r] = await ex
    .select({ total: sql<string>`coalesce(sum(${aiCalls.costUsd}), 0)` })
    .from(aiCalls)
    .where(and(eq(aiCalls.keyKind, keyKind), gte(aiCalls.at, start), ...(task ? [eq(aiCalls.task, task)] : [])));
  return Number(r?.total ?? 0);
}

/** Gasto do dia do copiloto (turnos + frase do salão) na chave: um teto só (revisão S8, segurança 6). */
export async function copilotSpentToday(ex: Executor, keyKind: KeyKind, now: Date): Promise<number> {
  return (await spentToday(ex, keyKind, now, "copiloto")) + (await spentToday(ex, keyKind, now, "salao_frase"));
}
