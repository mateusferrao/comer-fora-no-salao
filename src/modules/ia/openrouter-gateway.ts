import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  APICallError,
  generateText,
  JSONParseError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  stepCountIs,
  tool,
  TypeValidationError,
  type ModelMessage,
} from "ai";
import { AiGatewayError, type AgentStep, type AiGateway, type AiGenerateRequest, type AiGenerateResult, type AiInput } from "./gateway";

export function toMessages(input: AiInput): ModelMessage[] {
  if ("messages" in input) return input.messages.map((m) => ({ role: m.role, content: m.text }));
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

/** Junta ao erro o que os passos do agente já cobraram (o `run-task` grava em `attempts`). */
export function withPaidUsage(e: unknown, paid: { inTokens: number; outTokens: number; costUsd: number }): unknown {
  if (!paid.costUsd && !paid.inTokens) return e;
  if (e instanceof AiGatewayError) {
    return new AiGatewayError(e.kind, e.message, e.status, {
      inTokens: Math.max(e.usage?.inTokens ?? 0, paid.inTokens),
      outTokens: Math.max(e.usage?.outTokens ?? 0, paid.outTokens),
      costUsd: (e.usage?.costUsd ?? 0) || paid.costUsd || undefined,
    });
  }
  if (e && typeof e === "object") (e as { aiUsage?: unknown }).aiUsage = { ...paid, costUsd: paid.costUsd || undefined };
  return e;
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
      // Agente (S6.3b — D166): ferramentas do nosso código, escolha automática (o Gemini recusa ferramenta obrigatória
      // junto com saída JSON — spike de 21/11), último passo sem ferramentas para a resposta final sair sempre.
      const steps: AgentStep[] = [];
      const maxSteps = req.maxSteps ?? 6;
      // Custo e tokens de cada passo já pago (revisão S4–S6, segurança 3): se o agente falhar depois de N passos, o
      // erro leva o que foi cobrado, e o teto diário vê o gasto real.
      const paid = { inTokens: 0, outTokens: 0, costUsd: 0 };
      const costOf = (pm: unknown) => (pm as { openrouter?: { usage?: { cost?: number } } } | undefined)?.openrouter?.usage?.cost;
      const agent = req.tools?.length
        ? {
            tools: Object.fromEntries(
              req.tools.map((t) => [
                t.name,
                tool({
                  description: t.description,
                  inputSchema: t.input,
                  execute: async (input: unknown) => {
                    const t0 = Date.now();
                    const output = await t.execute(input);
                    steps.push({ tool: t.name, input, output, ms: Date.now() - t0 });
                    return output;
                  },
                }),
              ]),
            ),
            stopWhen: stepCountIs(maxSteps),
            onStepEnd: (st: { usage?: { inputTokens?: number; outputTokens?: number }; providerMetadata?: unknown }) => {
              paid.inTokens += st.usage?.inputTokens ?? 0;
              paid.outTokens += st.usage?.outputTokens ?? 0;
              paid.costUsd += costOf(st.providerMetadata) ?? 0;
            },
            prepareStep: ({ stepNumber }: { stepNumber: number }) => (stepNumber >= maxSteps - 1 ? { activeTools: [], toolChoice: "none" as const } : { toolChoice: "auto" as const }),
            ...(req.stepMs ? { timeout: { stepMs: req.stepMs } } : {}),
          }
        : {};
      try {
        const result = await generateText({
          model,
          system: req.system,
          messages: toMessages(req.input),
          ...agent,
          output: Output.object({ schema: req.schema }),
          maxRetries: 0,
          maxOutputTokens: req.maxOutputTokens,
          abortSignal: req.signal,
          runtimeContext: { ...(req.telemetry?.metadata ?? {}) },
          telemetry: {
            functionId: req.telemetry?.functionId,
            // Arquivos (foto/PDF do cardápio) nunca vão para o rastro: "imagem nunca guardada" (espec. 4.4, D46).
            recordInputs: !("files" in req.input) && !req.privateTrace,
            ...(req.privateTrace ? { recordOutputs: false } : {}),
            includeRuntimeContext: Object.fromEntries(Object.keys(req.telemetry?.metadata ?? {}).map((k) => [k, true])),
          },
        });
        // Custo: no agente, a soma de todos os passos (o `providerMetadata` de fora é só do último — revisão I4).
        const costs = (req.tools?.length ? result.steps.map((st) => costOf(st.providerMetadata)) : [costOf(result.providerMetadata)]).filter((c): c is number => typeof c === "number");
        return {
          output: result.output,
          model: result.response.modelId ?? req.model.id,
          usage: {
            inTokens: result.usage.inputTokens ?? 0,
            outTokens: result.usage.outputTokens ?? 0,
            costUsd: costs.length ? costs.reduce((a, b) => a + b, 0) : undefined,
          },
          ...(req.tools?.length ? { steps } : {}),
        };
      } catch (err) {
        throw withPaidUsage(classifyGatewayError(err), paid);
      }
    },
  };
}
