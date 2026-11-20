import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  APICallError,
  generateText,
  JSONParseError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  TypeValidationError,
  type ModelMessage,
} from "ai";
import { AiGatewayError, type AiGateway, type AiGenerateRequest, type AiGenerateResult, type AiInput } from "./gateway";

function toMessages(input: AiInput): ModelMessage[] {
  if (!("files" in input)) return [{ role: "user", content: input.text }];
  return [
    {
      role: "user",
      content: [
        { type: "text", text: input.text },
        ...input.files.map((f) => ({ type: "file" as const, data: f.data, mediaType: f.mediaType })),
      ],
    },
  ];
}

/** Traduz os erros do AI SDK para as classes do laço de reserva (D53). */
export function classifyGatewayError(err: unknown): unknown {
  if (err instanceof Error && err.name === "AbortError") return err;
  if (APICallError.isInstance(err)) {
    if (err.statusCode === 402) return new AiGatewayError("credit", "OpenRouter sem crédito (402)", 402);
    if (err.statusCode === 401 || err.statusCode === 403) {
      return new AiGatewayError("auth", `OpenRouter recusou a chave (${err.statusCode})`, err.statusCode);
    }
    return new AiGatewayError("provider", `OpenRouter respondeu ${err.statusCode ?? "?"}`, err.statusCode);
  }
  if (NoObjectGeneratedError.isInstance(err)) {
    // A chamada foi cobrada: guarda os tokens para o custo real da tentativa.
    const u = err.usage;
    const usage = u ? { inTokens: u.inputTokens ?? 0, outTokens: u.outputTokens ?? 0 } : undefined;
    return new AiGatewayError("invalid", "saída fora do schema", undefined, usage);
  }
  if (
    NoOutputGeneratedError.isInstance(err) ||
    TypeValidationError.isInstance(err) ||
    JSONParseError.isInstance(err)
  ) {
    return new AiGatewayError("invalid", "saída fora do schema");
  }
  return err;
}

/**
 * Gateway do OpenRouter (D52). Sem retentativa do SDK (o laço é nosso), sem plugin de reparo de JSON
 * (não mascara a taxa de reserva) e com `usage.include` para o custo real.
 */
export function createOpenRouterGateway(apiKey: string): AiGateway {
  if (!apiKey) throw new Error("chave do OpenRouter ausente");
  const openrouter = createOpenRouter({ apiKey, compatibility: "strict" });

  return {
    async generate(req: AiGenerateRequest): Promise<AiGenerateResult> {
      const model = openrouter(req.model.id, {
        usage: { include: true },
        // Só provedores que aceitam todos os parâmetros pedidos (saída estruturada) e que não guardam os dados
        // para treino (`data_collection: deny` — dívida 26 da revisão da S0).
        provider: { require_parameters: true, data_collection: "deny", ...(req.model.sort ? { sort: req.model.sort } : {}) },
        ...(req.model.reasoningEffort ? { reasoning: { effort: req.model.reasoningEffort, exclude: true } } : {}),
      });
      try {
        const result = await generateText({
          model,
          system: req.system,
          messages: toMessages(req.input),
          output: Output.object({ schema: req.schema }),
          maxRetries: 0,
          maxOutputTokens: req.maxOutputTokens,
          abortSignal: req.signal,
          runtimeContext: { ...(req.telemetry?.metadata ?? {}) },
          telemetry: {
            functionId: req.telemetry?.functionId,
            // Arquivos (foto/PDF do cardápio) nunca vão para o rastro: "imagem nunca guardada" (espec. 4.4, D46).
            recordInputs: !("files" in req.input),
            includeRuntimeContext: Object.fromEntries(Object.keys(req.telemetry?.metadata ?? {}).map((k) => [k, true])),
          },
        });
        const orUsage = (result.providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage;
        return {
          output: result.output,
          model: result.response.modelId ?? req.model.id,
          usage: {
            inTokens: result.usage.inputTokens ?? 0,
            outTokens: result.usage.outputTokens ?? 0,
            costUsd: typeof orUsage?.cost === "number" ? orUsage.cost : undefined,
          },
        };
      } catch (err) {
        throw classifyGatewayError(err);
      }
    },
  };
}
