import { APICallError, NoObjectGeneratedError } from "ai";
import { describe, expect, it } from "vitest";
import { AiGatewayError } from "@/src/modules/ia/gateway";
import { classifyGatewayError, withPaidUsage } from "@/src/modules/ia/openrouter-gateway";

const apiError = (statusCode: number) =>
  new APICallError({ message: `status ${statusCode}`, url: "https://openrouter.ai/api/v1/chat/completions", requestBodyValues: {}, statusCode });

const kind = (err: unknown) => (classifyGatewayError(err) as AiGatewayError).kind;

describe("classifyGatewayError (erros reais do AI SDK)", () => {
  it("402 → credit (encerra o laço)", () => {
    expect(kind(apiError(402))).toBe("credit");
  });
  it.each([401, 403])("%s → auth (chave inválida ou revogada, encerra o laço)", (s) => {
    expect(kind(apiError(s))).toBe("auth");
  });
  it.each([429, 500, 502, 503, 400])("%s → provider (tenta o próximo modelo)", (s) => {
    expect(kind(apiError(s))).toBe("provider");
  });
  it("saída fora do schema → invalid, mantendo os tokens cobrados", () => {
    const err = new NoObjectGeneratedError({
      message: "No object generated",
      text: "{}",
      response: { id: "x", timestamp: new Date(), modelId: "google/gemini-2.5-flash-lite" },
      usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 } as never,
      finishReason: "stop" as never,
    });
    const out = classifyGatewayError(err) as AiGatewayError;
    expect(out.kind).toBe("invalid");
    expect(out.usage).toEqual({ inTokens: 50, outTokens: 20 });
  });
  it("AbortError passa como está (o laço trata como tempo esgotado)", () => {
    const abort = new DOMException("aborted", "AbortError");
    expect(classifyGatewayError(abort)).toBe(abort);
  });
  it("mensagem do erro não carrega o corpo da resposta do provedor", () => {
    const out = classifyGatewayError(apiError(503)) as AiGatewayError;
    expect(out.message).toBe("OpenRouter respondeu 503");
  });
});

describe("custo dos passos já pagos quando o agente falha (revisão S4–S6, segurança 3)", () => {
  const paid = { inTokens: 900, outTokens: 300, costUsd: 0.004 };
  it("erro do gateway sem uso: ganha o custo dos passos", () => {
    const e = withPaidUsage(new AiGatewayError("invalid", "saída fora do schema"), paid) as AiGatewayError;
    expect(e).toBeInstanceOf(AiGatewayError);
    expect(e.kind).toBe("invalid");
    expect(e.usage).toEqual({ inTokens: 900, outTokens: 300, costUsd: 0.004 });
  });
  it("tempo esgotado (AbortError): o custo vai junto em aiUsage; sem passos pagos, nada muda", () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect((withPaidUsage(abort, paid) as { aiUsage?: unknown }).aiUsage).toEqual({ inTokens: 900, outTokens: 300, costUsd: 0.004 });
    const clean = new AiGatewayError("provider", "x");
    expect(withPaidUsage(clean, { inTokens: 0, outTokens: 0, costUsd: 0 })).toBe(clean);
  });
});
