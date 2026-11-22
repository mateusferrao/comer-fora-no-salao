/**
 * Qual chave do OpenRouter usar (D60, D85): a pública para todos; a de demo para as contas dos e-mails em
 * `PRESENTER_EMAILS` (comparados por HMAC — o e-mail não é guardado). Sem chave → modo sem IA. Contas E2E (S9) → modo
 * sem IA, salvo com `E2E_COM_IA=1`.
 */
import type { Executor } from "@/src/db/executor";
import { hmacEmail } from "@/src/shared/crypto";
import { normalizeEmail } from "@/src/modules/contas/domain/login-code";
import { createOpenRouterGateway } from "./openrouter-gateway";
import type { AiGateway } from "./gateway";
import { PUBLIC_DAILY_CAP_USD, spentToday, type KeyKind } from "./ai-calls";

export function keyKindFor(owner: { emailHmac: string | null; via?: string | null }, env: NodeJS.ProcessEnv = process.env): KeyKind {
  // S9: a fumaça de produção (contas E2E) roda a cada deploy; sem isto, gerava plano e kit com a chave pública.
  // Um teste que precise de IA liga `E2E_COM_IA=1` no servidor e volta à chave pública.
  if (owner.via === "e2e" && env.E2E_COM_IA !== "1") return "e2e";
  // Conta aberta pelo link privado do avaliador (D126) usa a chave de demo: o teto diário da chave pública
  // pode ser gasto por terceiros e derrubar a IA justamente de quem avalia (revisão da S2). O link tem um limite diário (EVALUATOR_DAILY_LIMIT).
  if (owner.via === "link") return "demo";
  if (!owner.emailHmac || !env.PRESENTER_EMAILS) return "publica";
  const presenters = env.PRESENTER_EMAILS.split(",").map((e) => normalizeEmail(e)).filter(Boolean);
  return presenters.some((e) => hmacEmail(e) === owner.emailHmac) ? "demo" : "publica";
}

/**
 * Limpa a chave lida do ambiente: espaços nas pontas e aspas em volta (retas ou "curvas", comuns ao colar
 * de um editor de texto). Com aspas curvas o cabeçalho Authorization nem chega a sair (ByteString inválida)
 * e toda chamada caía em "provider" — achado na revisão da S2. Chave com caractere fora do ASCII → ausente.
 */
export function cleanApiKey(raw: string | undefined): string {
  const k = (raw ?? "").trim().replace(/^["'\u201c\u201d\u2018\u2019]+|["'\u201c\u201d\u2018\u2019]+$/g, "").trim();
  return /^[\x21-\x7e]+$/.test(k) ? k : "";
}

/** Estado de uma chave para o health (nunca o valor). */
export function keyState(raw: string | undefined): "ok" | "ajustada" | "ausente" {
  const k = cleanApiKey(raw);
  if (!k) return "ausente";
  return k === raw ? "ok" : "ajustada";
}

/** Teto diário da chave pública suspenso por variável de ambiente (D254): "1", "true" ou "sim". */
export function dailyCapOff(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^(1|true|sim)$/i.test((env.IA_SEM_TETO_DIARIO ?? "").trim());
}

export type GatewayChoice = { gateway: AiGateway | null; keyKind: KeyKind; reason?: "sem_chave" | "teto_diario" };

/** Gateway para a chamada; `null` = modo sem IA (sem chave ou teto diário da chave pública atingido). */
export async function gatewayFor(ex: Executor, keyKind: KeyKind, now: Date, env: NodeJS.ProcessEnv = process.env): Promise<GatewayChoice> {
  if (keyKind === "e2e") return { gateway: null, keyKind, reason: "sem_chave" };
  const key = cleanApiKey(keyKind === "demo" ? env.OPENROUTER_KEY_DEMO : env.OPENROUTER_KEY_PUBLIC);
  if (!key) return { gateway: null, keyKind, reason: "sem_chave" };
  // D254: `IA_SEM_TETO_DIARIO` (Easypanel; aplica com Restart, sem build) suspende o teto da chave pública.
  if (keyKind === "publica" && !dailyCapOff(env) && (await spentToday(ex, "publica", now)) >= PUBLIC_DAILY_CAP_USD) return { gateway: null, keyKind, reason: "teto_diario" };
  return { gateway: createOpenRouterGateway(key), keyKind };
}
