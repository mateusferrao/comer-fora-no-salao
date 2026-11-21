import type { ModelRef } from "@/src/modules/ia/gateway";

/** Concorrentes da T1 (D129): esforço de raciocínio baixo e provedor por latência (revisão T-I4). */
export type Entry = { label: string; ref: ModelRef; provider: string };
export const T1_MODELS: Entry[] = [
  { label: "gemini-2.5-flash-lite", provider: "google", ref: { id: "google/gemini-2.5-flash-lite", provider: "google", sort: "latency" } },
  { label: "gemini-3.1-flash-lite", provider: "google", ref: { id: "google/gemini-3.1-flash-lite", provider: "google", sort: "latency", reasoningEffort: "minimal" } },
  { label: "gpt-6-luna", provider: "openai", ref: { id: "openai/gpt-6-luna", provider: "openai", sort: "latency", reasoningEffort: "none" } },
  { label: "deepseek-v4.1-flash", provider: "deepseek", ref: { id: "deepseek/deepseek-v4.1-flash", provider: "deepseek", sort: "latency", reasoningEffort: "none", imageOnly: true } },
  { label: "claude-haiku-5.5", provider: "anthropic", ref: { id: "anthropic/claude-haiku-5.5", provider: "anthropic", sort: "latency", reasoningEffort: "none" } },
  { label: "qwen3.8-flash", provider: "qwen", ref: { id: "qwen/qwen3.8-flash", provider: "qwen", sort: "latency", imageOnly: true } },
  { label: "gemini-3.8-flash (referência)", provider: "google", ref: { id: "google/gemini-3.8-flash", provider: "google", sort: "latency", reasoningEffort: "low" } },
];
export const HYBRID_TEXT_MODEL: ModelRef = { id: "google/gemini-2.5-flash-lite", provider: "google", sort: "latency" };
