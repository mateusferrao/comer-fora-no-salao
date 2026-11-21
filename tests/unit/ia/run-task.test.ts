import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fixedClock, systemClock } from "@/src/shared/clock";
import { AiGatewayError, type AiGateway, type ModelRef, type Tracer } from "@/src/modules/ia/gateway";
import { runTask, type TaskDef } from "@/src/modules/ia/run-task";

const schema = z.object({ titulo: z.string() });
const A: ModelRef = { id: "a/modelo-a", provider: "a" };
const B: ModelRef = { id: "b/modelo-b", provider: "b" };
const C: ModelRef = { id: "c/modelo-c", provider: "c" };

const task = (over: Partial<TaskDef<z.infer<typeof schema>>> = {}): TaskDef<z.infer<typeof schema>> => ({
  name: "teste",
  promptVersion: "v1",
  models: [A, B],
  schema,
  perAttemptTimeoutMs: 1_000,
  totalBudgetMs: 10_000,
  ...over,
});

type Behavior = { output?: unknown; error?: unknown; delayMs?: number; never?: boolean };

function fakeGateway(behaviors: Record<string, Behavior>) {
  const calls: string[] = [];
  const gateway: AiGateway = {
    generate: vi.fn(async ({ model, signal }) => {
      calls.push(model.id);
      const b = behaviors[model.id] ?? {};
      if (b.never) return new Promise<never>(() => {});
      if (b.delayMs) {
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, b.delayMs);
          signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }
      if (b.error) throw b.error;
      return { output: b.output, usage: { inTokens: 10, outTokens: 5, costUsd: 0.0001 }, model: model.id };
    }),
  };
  return { gateway, calls };
}

function recordingTracer() {
  const tasks: Array<{ name: string; meta: Record<string, unknown> }> = [];
  const attempts: Array<{ meta: Record<string, unknown>; result: unknown }> = [];
  const tracer: Tracer = {
    task: async (name, meta, fn) => {
      tasks.push({ name, meta });
      return fn();
    },
    attempt: async (meta, fn) => {
      const result = await fn();
      attempts.push({ meta, result });
      return result;
    },
  };
  return { tracer, tasks, attempts };
}

const run = (t: TaskDef<z.infer<typeof schema>>, gateway: AiGateway, trace: Tracer = recordingTracer().tracer) =>
  runTask(t, "sistema", { text: "entrada" }, { gateway, clock: systemClock, trace });

describe("runTask — laço de reserva", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T20:10:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("1º devolve JSON fora do schema e o 2º devolve válido → ok com o 2º", async () => {
    const { gateway } = fakeGateway({ [A.id]: { output: { errado: 1 } }, [B.id]: { output: { titulo: "Oi" } } });
    const r = await run(task(), gateway);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.model).toBe(B.id);
    expect(r.data).toEqual({ titulo: "Oi" });
    expect(r.attempts.map((a) => [a.model, a.ok, a.error])).toEqual([
      [A.id, false, "invalid"],
      [B.id, true, undefined],
    ]);
    expect(r.attempts[1]).toMatchObject({ inTokens: 10, outTokens: 5, costUsd: 0.0001 });
  });

  it("todos inválidos → fallback invalid", async () => {
    const { gateway } = fakeGateway({ [A.id]: { output: {} }, [B.id]: { output: "texto" } });
    const r = await run(task(), gateway);
    expect(r).toMatchObject({ status: "fallback", reason: "invalid" });
    expect(r.attempts).toHaveLength(2);
  });

  it("erro de saída inválida vindo do gateway também conta como invalid", async () => {
    const { gateway } = fakeGateway({
      [A.id]: { error: new AiGatewayError("invalid", "sem objeto") },
      [B.id]: { output: { titulo: "ok" } },
    });
    const r = await run(task(), gateway);
    expect(r.attempts[0]?.error).toBe("invalid");
    expect(r.status).toBe("ok");
  });

  it("guard reprova no 1º → passa ao 2º", async () => {
    const { gateway } = fakeGateway({ [A.id]: { output: { titulo: "proibido" } }, [B.id]: { output: { titulo: "bom" } } });
    const guard = (d: { titulo: string }) =>
      d.titulo === "proibido" ? { ok: false as const, reasons: ["palavra proibida"] } : { ok: true as const };
    const r = await run(task({ guard }), gateway);
    expect(r.status).toBe("ok");
    expect(r.attempts.map((a) => a.error)).toEqual(["guard", undefined]);
  });

  it("1º estoura o tempo por tentativa → timeout e passa ao próximo", async () => {
    const { gateway } = fakeGateway({ [A.id]: { delayMs: 5_000 }, [B.id]: { output: { titulo: "ok" } } });
    const p = run(task(), gateway);
    await vi.advanceTimersByTimeAsync(1_001);
    const r = await p;
    expect(r.status).toBe("ok");
    expect(r.attempts[0]).toMatchObject({ model: A.id, ok: false, error: "timeout" });
    expect(r.attempts[0]?.latencyMs).toBeGreaterThanOrEqual(1_000);
  });

  it("tentativa que nunca responde nem ouve o sinal também é cortada", async () => {
    const { gateway } = fakeGateway({ [A.id]: { never: true }, [B.id]: { output: { titulo: "ok" } } });
    const p = run(task(), gateway);
    await vi.advanceTimersByTimeAsync(1_001);
    expect((await p).status).toBe("ok");
  });

  it("orçamento total estourado → fallback timeout", async () => {
    const { gateway, calls } = fakeGateway({ [A.id]: { delayMs: 5_000 }, [B.id]: { delayMs: 5_000 }, [C.id]: { output: { titulo: "x" } } });
    const p = run(task({ models: [A, B, C], perAttemptTimeoutMs: 1_000, totalBudgetMs: 1_500 }), gateway);
    await vi.advanceTimersByTimeAsync(3_000);
    const r = await p;
    expect(r).toMatchObject({ status: "fallback", reason: "timeout" });
    expect(calls).toEqual([A.id, B.id]);
  });

  it("1º responde 503 → provider e passa ao próximo", async () => {
    const { gateway } = fakeGateway({
      [A.id]: { error: new AiGatewayError("provider", "503", 503) },
      [B.id]: { output: { titulo: "ok" } },
    });
    const r = await run(task(), gateway);
    expect(r.status).toBe("ok");
    expect(r.attempts[0]?.error).toBe("provider");
  });

  it("erro desconhecido do gateway conta como provider", async () => {
    const { gateway } = fakeGateway({ [A.id]: { error: new Error("rede") }, [B.id]: { output: { titulo: "ok" } } });
    const r = await run(task(), gateway);
    expect(r.attempts[0]?.error).toBe("provider");
  });

  it("1º responde 402 → fallback unavailable sem chamar o 2º", async () => {
    const { gateway, calls } = fakeGateway({
      [A.id]: { error: new AiGatewayError("credit", "402", 402) },
      [B.id]: { output: { titulo: "ok" } },
    });
    const r = await run(task(), gateway);
    expect(r).toMatchObject({ status: "fallback", reason: "unavailable" });
    expect(calls).toEqual([A.id]);
    expect(r.attempts[0]?.error).toBe("credit");
  });

  it("todos indisponíveis → fallback unavailable", async () => {
    const err = () => new AiGatewayError("provider", "503", 503);
    const { gateway } = fakeGateway({ [A.id]: { error: err() }, [B.id]: { error: err() } });
    expect(await run(task(), gateway)).toMatchObject({ status: "fallback", reason: "unavailable" });
  });

  it("motivos misturados: inválido tem precedência; senão timeout; senão unavailable [C]", async () => {
    const g1 = fakeGateway({ [A.id]: { output: {} }, [B.id]: { error: new AiGatewayError("provider", "503", 503) } });
    expect(await run(task(), g1.gateway)).toMatchObject({ reason: "invalid" });

    const g2 = fakeGateway({ [A.id]: { delayMs: 5_000 }, [B.id]: { error: new AiGatewayError("provider", "503", 503) } });
    const p = run(task(), g2.gateway);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(await p).toMatchObject({ reason: "timeout" });
  });

  it("o tracer recebe 1 task e 1 attempt por tentativa com model, ok e latencyMs", async () => {
    const rec = recordingTracer();
    const { gateway } = fakeGateway({ [A.id]: { output: {} }, [B.id]: { output: { titulo: "ok" } } });
    await run(task(), gateway, rec.tracer);
    expect(rec.tasks).toHaveLength(1);
    expect(rec.tasks[0]).toMatchObject({ name: "teste", meta: { promptVersion: "v1" } });
    expect(rec.attempts).toHaveLength(2);
    expect(rec.attempts.map((a) => a.meta.model)).toEqual([A.id, B.id]);
    for (const a of rec.attempts) expect(a.result).toEqual(expect.objectContaining({ model: expect.any(String), ok: expect.any(Boolean), latencyMs: expect.any(Number) }));
  });

  it("tracer que lança não derruba o runTask", async () => {
    const broken: Tracer = {
      task: () => {
        throw new Error("exportador fora");
      },
      attempt: async () => {
        throw new Error("exportador fora");
      },
    };
    const { gateway, calls } = fakeGateway({ [A.id]: { output: { titulo: "ok" } } });
    const r = await run(task(), gateway, broken);
    expect(r.status).toBe("ok");
    expect(calls).toEqual([A.id]);
  });

  it("tracer que lança depois de rodar a tentativa não a repete", async () => {
    const late: Tracer = {
      task: async (_n, _m, fn) => fn(),
      attempt: async (_m, fn) => {
        await fn();
        throw new Error("falhou ao exportar");
      },
    };
    const { gateway, calls } = fakeGateway({ [A.id]: { output: { titulo: "ok" } } });
    const r = await run(task(), gateway, late);
    expect(r.status).toBe("ok");
    expect(calls).toEqual([A.id]);
  });
});

describe("runTask — correções da revisão S0", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T20:10:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("orçamento e latência usam cronômetro próprio, não o relógio de negócio (fixedClock)", async () => {
    const { gateway } = fakeGateway({ [A.id]: { delayMs: 5_000 }, [B.id]: { delayMs: 5_000 }, [C.id]: { output: { titulo: "x" } } });
    const p = runTask(task({ models: [A, B, C], perAttemptTimeoutMs: 1_000, totalBudgetMs: 1_500 }), "s", { text: "e" }, {
      gateway,
      clock: fixedClock("2026-11-23T20:10:00Z"),
      trace: recordingTracer().tracer,
    });
    await vi.advanceTimersByTimeAsync(3_000);
    const r = await p;
    expect(r).toMatchObject({ status: "fallback", reason: "timeout" });
    expect(r.attempts[0]?.latencyMs).toBeGreaterThanOrEqual(1_000);
  });

  it("registra o modelo realmente servido", async () => {
    const gateway: AiGateway = {
      generate: async () => ({ output: { titulo: "ok" }, usage: { inTokens: 1, outTokens: 1 }, model: "a/modelo-a-2026-11" }),
    };
    const r = await run(task(), gateway);
    expect(r.attempts[0]).toMatchObject({ model: A.id, servedModel: "a/modelo-a-2026-11" });
  });

  it("guarda os motivos do guard nas notas da tentativa", async () => {
    const { gateway } = fakeGateway({ [A.id]: { output: { titulo: "x" } }, [B.id]: { output: { titulo: "y" } } });
    const guard = (d: { titulo: string }) => (d.titulo === "x" ? { ok: false as const, reasons: ["palavra proibida: x"] } : { ok: true as const });
    const r = await run(task({ guard }), gateway);
    expect(r.attempts[0]).toMatchObject({ error: "guard", notes: ["palavra proibida: x"] });
  });

  it("guard que lança conta como guard (não como provedor) e registra o detalhe", async () => {
    const { gateway } = fakeGateway({ [A.id]: { output: { titulo: "x" } }, [B.id]: { output: { titulo: "y" } } });
    let n = 0;
    const guard = () => {
      if (n++ === 0) throw new Error("bug no guard");
      return { ok: true as const };
    };
    const r = await run(task({ guard }), gateway);
    expect(r.attempts[0]).toMatchObject({ error: "guard", detail: expect.stringContaining("bug no guard") });
    expect(r.status).toBe("ok");
  });

  it("erro do provedor guarda um detalhe curto", async () => {
    const { gateway } = fakeGateway({ [A.id]: { error: new AiGatewayError("provider", "OpenRouter respondeu 503", 503) }, [B.id]: { output: { titulo: "ok" } } });
    const r = await run(task(), gateway);
    expect(r.attempts[0]?.detail).toBe("OpenRouter respondeu 503");
  });

  it("saída inválida cobrada pelo provedor mantém tokens e custo", async () => {
    const err = new AiGatewayError("invalid", "saída fora do schema", undefined, { inTokens: 50, outTokens: 20, costUsd: 0.0001 });
    const { gateway } = fakeGateway({ [A.id]: { error: err }, [B.id]: { output: { titulo: "ok" } } });
    const r = await run(task(), gateway);
    expect(r.attempts[0]).toMatchObject({ error: "invalid", inTokens: 50, outTokens: 20, costUsd: 0.0001 });
  });

  it("chave inválida ou revogada (401/403) encerra o laço como indisponível", async () => {
    const { gateway, calls } = fakeGateway({ [A.id]: { error: new AiGatewayError("auth", "401", 401) }, [B.id]: { output: { titulo: "ok" } } });
    const r = await run(task(), gateway);
    expect(r).toMatchObject({ status: "fallback", reason: "unavailable" });
    expect(calls).toEqual([A.id]);
  });

  it("repassa maxOutputTokens ao gateway", async () => {
    const { gateway } = fakeGateway({ [A.id]: { output: { titulo: "ok" } } });
    await run(task({ maxOutputTokens: 400 }), gateway);
    expect(vi.mocked(gateway.generate).mock.calls[0]?.[0].maxOutputTokens).toBe(400);
  });

  it("cancelamento vindo de fora interrompe a tentativa e não tenta os próximos modelos", async () => {
    const { gateway, calls } = fakeGateway({ [A.id]: { delayMs: 5_000 }, [B.id]: { output: { titulo: "ok" } } });
    const outside = new AbortController();
    const p = runTask(task(), "s", { text: "e" }, { gateway, clock: systemClock, trace: recordingTracer().tracer, signal: outside.signal });
    await vi.advanceTimersByTimeAsync(100);
    outside.abort();
    const r = await p;
    expect(r).toMatchObject({ status: "fallback", reason: "timeout" });
    expect(calls).toEqual([A.id]);
  });
});
