/**
 * Modelos por tarefa (D51). Cardápio: escolhido pela T1 (eval/relatorio-t1.md; D131). Pacote/plano: escolhidos
 * pela T3 (eval/relatorio-t3.md; D147) — vencedor + reserva de outro provedor (o laço troca de provedor).
 * Kit: segue a T3 [C] (mesma família de texto curto com referências).
 */
import type { ModelRef } from "./gateway";

const GEMINI_31_FLASH_LITE: ModelRef = { id: "google/gemini-3.1-flash-lite", provider: "google", sort: "latency", reasoningEffort: "minimal" };
const GEMINI_38_FLASH: ModelRef = { id: "google/gemini-3.8-flash", provider: "google", sort: "latency", reasoningEffort: "low" };
/** Revisor (espec. 4.4): 3º provedor, fora do laço do kit/plano (google + openai). */
const DEEPSEEK_V41_FLASH: ModelRef = { id: "deepseek/deepseek-v4.1-flash", provider: "deepseek", sort: "latency", reasoningEffort: "none" };
const GPT_6_LUNA: ModelRef = { id: "openai/gpt-6-luna", provider: "openai", sort: "latency", reasoningEffort: "none" };

export const MODELS = {
  cardapio: [GEMINI_31_FLASH_LITE, GPT_6_LUNA],
  pacote: [GEMINI_38_FLASH, GPT_6_LUNA],
  kit: [GEMINI_38_FLASH, GPT_6_LUNA],
  revisor: [DEEPSEEK_V41_FLASH],
} satisfies Record<string, ModelRef[]>;
