import type { ZodType } from "zod";
import type { Clock } from "../../shared/clock";
import { AiGatewayError, type AgentStep, type AiGateway, type AiInput, type AiTool, type AiUsage, type GuardResult, type ModelRef, type Tracer } from "./gateway";
import { safeErr } from "@/src/shared/safe-err";
import { log } from "@/src/shared/log";

export interface TaskDef<T> {
  name: string;
  promptVersion: string;
  models: ModelRef[];
  schema: ZodType<T>;
  perAttemptTimeoutMs: number;
  totalBudgetMs: number;
  /** Teto de tokens de saída por tentativa. */
  maxOutputTokens?: number;
  guard?: (data: T) => GuardResult;
  /** Agente (S6.3b): ferramentas, passos e tempo por passo (o tempo da tentativa vale para o agente inteiro). */
  tools?: readonly AiTool[];
  maxSteps?: number;
  stepMs?: number;
}

export type AttemptError = "invalid" | "guard" | "timeout" | "provider" | "credit" | "auth";

export type AttemptLog = {
  /** Modelo pedido. */
  model: string;
  /** Modelo que o OpenRouter realmente serviu (pode trazer data/versão). */
  servedModel?: string;
  ok: boolean;
  error?: AttemptError;
  /** Motivos do guard (palavras proibidas, referência desconhecida…). */
  notes?: string[];
  /** Detalhe curto do erro, sem conteúdo do usuário. */
  detail?: string;
  latencyMs: number;
  inTokens?: number;
  outTokens?: number;
  costUsd?: number;
};

export type FallbackReason = "invalid" | "timeout" | "unavailable";

export type TaskResult<T> =
  | { status: "ok"; data: T; model: string; attempts: AttemptLog[]; steps?: AgentStep[] }
  | { status: "fallback"; reason: FallbackReason; attempts: AttemptLog[] };

export type RunTaskContext = {
  gateway: AiGateway;
  /** Relógio de negócio (datas). O tempo das tentativas usa `stopwatch`. */
  clock: Clock;
  trace: Tracer;
  /** Cancelamento vindo de fora (ex.: o cliente fechou a aba). */
  signal?: AbortSignal;
  /** Cronômetro em ms para orçamento e latência; padrão `Date.now`. Nunca o `Clock` (que pode estar fixo). */
  stopwatch?: () => number;
};

type AttemptOutcome<T> = { log: AttemptLog; data?: T; steps?: AgentStep[] };

const TIMEOUT = Symbol("timeout");
const CANCELLED = Symbol("cancelled");
const DETAIL_MAX = 200;

/**
 * Roda `fn` dentro do tracer sem nunca deixar uma falha do tracer derrubar a tarefa:
 * se o tracer lançar antes de rodar `fn`, roda `fn` direto; se lançar depois, aproveita o resultado.
 */
async function traced<R>(wrap: (fn: () => Promise<R>) => Promise<unknown>, fn: () => Promise<R>): Promise<R> {
  let started: Promise<R> | undefined;
  const inner = () => {
    started ??= fn();
    return started;
  };
  try {
    await wrap(inner);
  } catch (err) {
    log.warn("falha no rastro (ignorada)", { area: "ia", err: safeErr(err) });
  }
  return started ?? fn();
}

function classify(err: unknown): AttemptError {
  if (err === TIMEOUT || err === CANCELLED) return "timeout";
  if (err instanceof AiGatewayError) return err.kind;
  if (err instanceof Error && err.name === "AbortError") return "timeout";
  return "provider";
}

function detailOf(err: unknown): string | undefined {
  if (err === TIMEOUT) return "tempo da tentativa esgotado";
  if (err === CANCELLED) return "cancelado";
  if (err instanceof Error) return err.message.slice(0, DETAIL_MAX);
  return undefined;
}

function usageFields(u?: AiUsage) {
  return u ? { inTokens: u.inTokens, outTokens: u.outTokens, costUsd: u.costUsd } : {};
}

/** Precedência dos motivos de reserva quando as tentativas falham por motivos diferentes ([C], planejamento S0 §12). */
function fallbackReason(attempts: AttemptLog[]): FallbackReason {
  if (attempts.some((a) => a.error === "invalid" || a.error === "guard")) return "invalid";
  if (attempts.some((a) => a.error === "timeout")) return "timeout";
  return "unavailable";
}

/** Laço de reserva (D53): modelos em sequência, saída validada por Zod e guard, tempo por tentativa e orçamento total. */
export async function runTask<T>(task: TaskDef<T>, system: string, input: AiInput, ctx: RunTaskContext): Promise<TaskResult<T>> {
  const { gateway, trace, signal } = ctx;
  const now = ctx.stopwatch ?? Date.now;

  const body = async (): Promise<TaskResult<T>> => {
    const startedAt = now();
    const attempts: AttemptLog[] = [];

    for (const model of task.models) {
      if (signal?.aborted) return { status: "fallback", reason: "timeout", attempts };
      const remaining = task.totalBudgetMs - (now() - startedAt);
      if (remaining <= 0) return { status: "fallback", reason: "timeout", attempts };
      const limitMs = Math.min(task.perAttemptTimeoutMs, remaining);

      const outcome = await traced<AttemptOutcome<T>>(
        (fn) => trace.attempt({ model: model.id, provider: model.provider, limitMs }, async () => (await fn()).log),
        () => attempt(model, limitMs),
      );
      attempts.push(outcome.log);

      if (outcome.log.ok && outcome.data !== undefined) {
        return { status: "ok", data: outcome.data, model: model.id, attempts, ...(outcome.steps ? { steps: outcome.steps } : {}) };
      }
      if (outcome.log.error === "credit" || outcome.log.error === "auth") return { status: "fallback", reason: "unavailable", attempts };
      if (signal?.aborted) return { status: "fallback", reason: "timeout", attempts };
      if (now() - startedAt >= task.totalBudgetMs) return { status: "fallback", reason: "timeout", attempts };
    }
    return { status: "fallback", reason: fallbackReason(attempts), attempts };
  };

  const attempt = async (model: ModelRef, limitMs: number): Promise<AttemptOutcome<T>> => {
    const t0 = now();
    const latency = () => now() - t0;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onOutsideAbort: (() => void) | undefined;
    const stop = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(TIMEOUT);
      }, limitMs);
      onOutsideAbort = () => {
        controller.abort();
        reject(CANCELLED);
      };
      signal?.addEventListener("abort", onOutsideAbort, { once: true });
    });

    try {
      const res = await Promise.race([
        gateway.generate({
          model,
          system,
          input,
          schema: task.schema,
          signal: controller.signal,
          maxOutputTokens: task.maxOutputTokens,
          telemetry: { functionId: task.name, metadata: { promptVersion: task.promptVersion } },
          ...(task.tools?.length ? { tools: task.tools, maxSteps: task.maxSteps, stepMs: task.stepMs } : {}),
        }),
        stop,
      ]);
      const base = { model: model.id, servedModel: res.model, ...usageFields(res.usage) };
      const parsed = task.schema.safeParse(res.output);
      if (!parsed.success) return { log: { ...base, ok: false, error: "invalid", latencyMs: latency() } };

      let verdict: GuardResult;
      try {
        verdict = task.guard?.(parsed.data) ?? { ok: true };
      } catch (err) {
        log.error("guard lançou exceção", { area: "ia", task: task.name, err: err instanceof Error ? err.name : "erro" });
        return { log: { ...base, ok: false, error: "guard", detail: detailOf(err), latencyMs: latency() } };
      }
      if (!verdict.ok) return { log: { ...base, ok: false, error: "guard", notes: verdict.reasons, latencyMs: latency() } };
      return { log: { ...base, ok: true, latencyMs: latency() }, data: parsed.data, ...(res.steps ? { steps: res.steps } : {}) };
    } catch (err) {
      const usage = err instanceof AiGatewayError ? usageFields(err.usage) : {};
      return { log: { model: model.id, ok: false, error: classify(err), detail: detailOf(err), latencyMs: latency(), ...usage } };
    } finally {
      clearTimeout(timer);
      if (onOutsideAbort) signal?.removeEventListener("abort", onOutsideAbort);
    }
  };

  return traced(
    (fn) => trace.task(task.name, { promptVersion: task.promptVersion, models: task.models.map((m) => m.id) }, fn),
    body,
  );
}
