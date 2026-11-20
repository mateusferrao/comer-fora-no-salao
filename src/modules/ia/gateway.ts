import type { ZodType } from "zod";

/** Entrada da IA: só texto, ou texto + arquivos (foto/PDF do cardápio na S2). */
export type AiInput = { text: string } | { text: string; files: Array<{ data: Uint8Array | URL; mediaType: string }> };

export type ModelRef = {
  id: string;
  provider: string;
  acceptsPdf?: boolean;
  /** Esforço de raciocínio pedido ao modelo (T1: baixo para latência; revisão T-I4). */
  reasoningEffort?: "none" | "minimal" | "low" | "medium";
  /** Ordem de provedores no OpenRouter (ex.: "latency" evita o tier flex lento do Gemini — T-I4). */
  sort?: "latency" | "price" | "throughput";
  /** Aceita só imagem (sem PDF/arquivo) — irrelevante depois da D127 (PDF vira imagem no navegador). */
  imageOnly?: boolean;
};

export type GuardResult = { ok: true } | { ok: false; reasons: string[] };

export type AiUsage = { inTokens: number; outTokens: number; costUsd?: number };

export type AiGenerateRequest = {
  model: ModelRef;
  system: string;
  input: AiInput;
  schema: ZodType<unknown>;
  signal: AbortSignal;
  /** Teto de tokens de saída (também evita 402 por custo estimado acima do limite da chave). */
  maxOutputTokens?: number;
  /** Metadados para o rastro (nome da tarefa, versão do prompt). */
  telemetry?: { functionId: string; metadata?: Record<string, string> };
};

export type AiGenerateResult = { output: unknown; usage: AiUsage; model: string };

/** Porta da IA (D52): só o OpenRouter implementa em produção. */
export interface AiGateway {
  generate(req: AiGenerateRequest): Promise<AiGenerateResult>;
}

/**
 * Erro classificado pelo gateway. `credit` (402) e `auth` (401/403: chave inválida ou revogada) encerram o laço,
 * porque todos os modelos usam a mesma chave; `provider` (5xx/429/rede) e `invalid` passam ao próximo modelo.
 * `usage` guarda o consumo quando a chamada foi cobrada mesmo com saída inválida.
 */
export class AiGatewayError extends Error {
  constructor(
    readonly kind: "provider" | "credit" | "auth" | "invalid",
    message: string,
    readonly status?: number,
    readonly usage?: AiUsage,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

/** Porta do rastro (Langfuse em produção). Nunca pode derrubar a tarefa. */
export interface Tracer {
  task<R>(name: string, meta: Record<string, unknown>, fn: () => Promise<R>): Promise<R>;
  attempt<R>(meta: Record<string, unknown>, fn: () => Promise<R>): Promise<R>;
}

export const noopTracer: Tracer = {
  task: (_name, _meta, fn) => fn(),
  attempt: (_meta, fn) => fn(),
};
