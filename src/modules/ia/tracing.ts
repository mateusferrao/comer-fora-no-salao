import { LangfuseSpanProcessor } from "@langfuse/otel";
import { startActiveObservation } from "@langfuse/tracing";
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { Context } from "@opentelemetry/api";
import type { ExportResult } from "@opentelemetry/core";
import type { ReadableSpan, Span, SpanExporter, SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { registerTelemetry } from "ai";
import { resolveGitSha } from "../../shared/git-sha";
import type { Tracer } from "./gateway";
import { safeErr } from "@/src/shared/safe-err";
import { log } from "@/src/shared/log";

/**
 * Adaptador do `Tracer` sobre o Langfuse (D59). Usa `startActiveObservation` para que os spans de
 * tarefa e de tentativa passem no filtro do Langfuse e a geração do AI SDK fique aninhada:
 * tarefa → tentativa → geração.
 */
export const langfuseTracer: Tracer = {
  task: (name, meta, fn) =>
    startActiveObservation(
      `tarefa:${name}`,
      async (span) => {
        span.update({ metadata: meta });
        const result = await fn();
        span.update({ output: summarize(result) });
        return result;
      },
      { asType: "chain" },
    ),
  attempt: (meta, fn) =>
    startActiveObservation(`tentativa:${String(meta.model ?? "?")}`, async (span) => {
      span.update({ metadata: meta });
      const result = await fn();
      span.update({ output: result as Record<string, unknown> });
      return result;
    }),
};

/** O rastro da tarefa guarda o desfecho e as tentativas, não os dados devolvidos. */
function summarize(result: unknown): unknown {
  if (result && typeof result === "object" && "status" in result) {
    const { status, attempts } = result as { status: string; attempts?: unknown };
    const extra = result as { model?: string; reason?: string };
    return { status, model: extra.model, reason: extra.reason, attempts };
  }
  return result;
}

const warn = (what: string, err: unknown) =>
  log.warn("falha no rastro (ignorada)", { area: "ia", reason: what, err: err instanceof Error ? err.name : "erro" });

/** Exportador que nunca lança: exceção vira resultado de falha (código 1 = FAILED). */
class SafeExporter implements SpanExporter {
  constructor(private readonly inner: SpanExporter) {}
  export(spans: ReadableSpan[], done: (r: ExportResult) => void): void {
    let called = false;
    const once = (r: ExportResult) => {
      if (called) return;
      called = true;
      done(r);
    };
    try {
      this.inner.export(spans, once);
    } catch (err) {
      warn("export", err);
      once({ code: 1, error: err instanceof Error ? err : new Error(String(err)) });
    }
  }
  async shutdown(): Promise<void> {
    try {
      await this.inner.shutdown();
    } catch (err) {
      warn("shutdown do exportador", err);
    }
  }
  async forceFlush(): Promise<void> {
    try {
      await this.inner.forceFlush?.();
    } catch (err) {
      warn("flush do exportador", err);
    }
  }
}

/** Processador que nunca deixa erro (síncrono ou promessa) escapar para a requisição. */
class SafeSpanProcessor implements SpanProcessor {
  constructor(private readonly inner: SpanProcessor) {}
  onStart(span: Span, ctx: Context): void {
    try {
      const r = this.inner.onStart(span, ctx) as unknown;
      if (r instanceof Promise) r.catch((err) => warn("onStart", err));
    } catch (err) {
      warn("onStart", err);
    }
  }
  onEnd(span: ReadableSpan): void {
    try {
      const r = this.inner.onEnd(span) as unknown;
      if (r instanceof Promise) r.catch((err) => warn("onEnd", err));
    } catch (err) {
      warn("onEnd", err);
    }
  }
  async forceFlush(): Promise<void> {
    try {
      await this.inner.forceFlush();
    } catch (err) {
      warn("flush", err);
    }
  }
  async shutdown(): Promise<void> {
    try {
      await this.inner.shutdown();
    } catch (err) {
      warn("shutdown", err);
    }
  }
}

const OMITTED = "[arquivo omitido]";
const DATA_URI = /data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/g;
const LONG_BASE64 = /^[A-Za-z0-9+/=\s]{1000,}$/;

/**
 * Máscara aplicada a tudo que vai ao Langfuse: arquivos (foto/PDF do cardápio) nunca saem do servidor
 * ("imagem nunca guardada", espec. 4.4, D46). Troca data URIs e blocos base64 longos por um marcador.
 */
export function maskTraceData({ data }: { data: unknown }): unknown {
  const walk = (v: unknown, depth: number): unknown => {
    if (typeof v === "string") {
      if (LONG_BASE64.test(v)) return OMITTED;
      return v.includes(";base64,") ? v.replace(DATA_URI, OMITTED) : v;
    }
    if (depth > 20 || v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
    if (v instanceof Uint8Array) return OMITTED;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, depth + 1)]));
  };
  return walk(data, 0);
}

export type TracingOptions = {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
  /** Separa os rastros de produção, desenvolvimento e spike. */
  environment?: string;
  /** Versão publicada (SHA do commit). */
  release?: string;
  /** Só para testes: troca o exportador HTTP do Langfuse. */
  exporter?: SpanExporter;
};

export type TracingHandle = { enabled: boolean; flush(): Promise<void>; shutdown(): Promise<void> };

const disabled: TracingHandle = { enabled: false, flush: async () => {}, shutdown: async () => {} };

const g = globalThis as typeof globalThis & { __salaoTracing?: TracingHandle };

/** Liga o OpenTelemetry com o exportador do Langfuse. Qualquer falha vira log; nunca lança. */
export function setupTracing(opts: TracingOptions): TracingHandle {
  if (!opts.publicKey || !opts.secretKey) {
    log.info("rastro desligado (sem chaves do Langfuse)", { area: "ia" });
    return disabled;
  }
  try {
    const processor = new LangfuseSpanProcessor({
      publicKey: opts.publicKey,
      secretKey: opts.secretKey,
      baseUrl: opts.baseUrl,
      exporter: opts.exporter ? new SafeExporter(opts.exporter) : undefined,
      // Nada de arquivo no Langfuse: sem upload de mídia e com máscara de base64.
      mediaUploadEnabled: false,
      mask: maskTraceData,
      environment: opts.environment,
      release: opts.release,
    });
    const safe = new SafeSpanProcessor(processor);
    const sdk = new NodeSDK({ spanProcessors: [safe] });
    sdk.start();
    registerTelemetry(new LangfuseVercelAiSdkIntegration());
    return {
      enabled: true,
      flush: () => safe.forceFlush(),
      shutdown: async () => {
        try {
          await sdk.shutdown();
        } catch (err) {
          log.warn("falha ao encerrar o rastro (ignorada)", { area: "ia", err: safeErr(err) });
        }
      },
    };
  } catch (err) {
    log.error("rastro desligado por erro na configuração", { area: "ia", err: safeErr(err) });
    return disabled;
  }
}

/** Uma vez por processo (o `next dev` recarrega módulos). Lê as variáveis LANGFUSE_*. */
export function setupTracingFromEnv(): TracingHandle {
  g.__salaoTracing ??= setupTracing({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
    environment: process.env.NODE_ENV === "production" ? "producao" : "desenvolvimento",
    release: resolveGitSha(),
  });
  return g.__salaoTracing;
}
