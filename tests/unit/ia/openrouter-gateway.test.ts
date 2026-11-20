import { APICallError, NoObjectGeneratedError } from "ai";
import { describe, expect, it } from "vitest";
import { AiGatewayError } from "@/src/modules/ia/gateway";
import { classifyGatewayError } from "@/src/modules/ia/openrouter-gateway";

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
