import type { ExportResult } from "@opentelemetry/core";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { systemClock } from "@/src/shared/clock";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { runTask } from "@/src/modules/ia/run-task";
import { langfuseTracer, setupTracing } from "@/src/modules/ia/tracing";

class ThrowingExporter implements SpanExporter {
  exported = 0;
  export(spans: ReadableSpan[], done: (r: ExportResult) => void): void {
    this.exported += spans.length;
    done({ code: 1, error: new Error("exportador fora do ar") });
    throw new Error("exportador explodiu");
  }
  shutdown() {
    return Promise.resolve();
  }
}

const gateway: AiGateway = {
  generate: async () => ({ output: { ok: true }, usage: { inTokens: 1, outTokens: 1 }, model: "x/y" }),
};

describe("rastro (Langfuse)", () => {
  const exporter = new ThrowingExporter();
  const tracing = setupTracing({ publicKey: "pk-lf-teste", secretKey: "sk-lf-teste", baseUrl: "http://127.0.0.1:9", exporter });

  afterAll(async () => {
    await tracing.shutdown();
  });

  it("liga o rastro quando há chaves", () => {
    expect(tracing.enabled).toBe(true);
  });

  it("exportador que lança não derruba a tarefa", async () => {
    const r = await runTask(
      { name: "t", promptVersion: "v1", models: [{ id: "x/y", provider: "x" }], schema: z.object({ ok: z.boolean() }), perAttemptTimeoutMs: 1_000, totalBudgetMs: 2_000 },
      "s",
      { text: "e" },
      { gateway, clock: systemClock, trace: langfuseTracer },
    );
    expect(r.status).toBe("ok");
    await tracing.flush();
    expect(exporter.exported).toBeGreaterThanOrEqual(2);
  });

  it("sem chaves, o rastro fica desligado e não lança", () => {
    const off = setupTracing({});
    expect(off.enabled).toBe(false);
  });
});

describe("rastro — correções da revisão S0", () => {
  it("mask apaga data URIs e base64 longos em qualquer profundidade", async () => {
    const { maskTraceData } = await import("@/src/modules/ia/tracing");
    const b64 = "A".repeat(2_000);
    const out = maskTraceData({
      data: { msg: [{ type: "file", data: `data:image/jpeg;base64,${b64}` }, { type: "text", text: "cardápio" }], raw: b64 },
    });
    const s = JSON.stringify(out);
    expect(s).not.toContain(b64);
    expect(s).toContain("cardápio");
    expect(s).toContain("[arquivo omitido]");
  });

  it("mask não altera textos comuns", async () => {
    const { maskTraceData } = await import("@/src/modules/ia/tracing");
    expect(maskTraceData({ data: "Moqueca da casa R$ 79,90" })).toBe("Moqueca da casa R$ 79,90");
  });

  it("exportador padrão com o Langfuse inacessível não derruba a tarefa nem gera rejeição solta", async () => {
    const rejections: unknown[] = [];
    const onRej = (r: unknown) => rejections.push(r);
    process.on("unhandledRejection", onRej);
    const t = setupTracing({ publicKey: "pk-lf-x", secretKey: "sk-lf-x", baseUrl: "http://127.0.0.1:9" });
    const r = await runTask(
      { name: "t", promptVersion: "v1", models: [{ id: "x/y", provider: "x" }], schema: z.object({ ok: z.boolean() }), perAttemptTimeoutMs: 1_000, totalBudgetMs: 2_000 },
      "s",
      { text: "e" },
      { gateway, clock: systemClock, trace: langfuseTracer },
    );
    expect(r.status).toBe("ok");
    await t.flush();
    await t.shutdown();
    await new Promise((res) => setTimeout(res, 50));
    process.off("unhandledRejection", onRej);
    expect(rejections).toEqual([]);
  }, 20_000);
});
