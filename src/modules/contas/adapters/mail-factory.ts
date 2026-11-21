import type { MailSender } from "./mail-sender";
import { memorySender } from "./memory-sender";
import { createSesSender } from "./ses-sender";

/**
 * SES quando as 4 variáveis existem; memória só com `MAIL_TRANSPORT=memory` explícito (nunca por falta
 * de configuração — revisão T-I7). Sem nenhum dos dois: `null` (login responde "envio indisponível").
 */
export function getMailSender(env: NodeJS.ProcessEnv = process.env): MailSender | null {
  if (env.MAIL_TRANSPORT === "memory") return memorySender;
  const { SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY, MAIL_FROM } = env;
  if (SES_REGION && SES_ACCESS_KEY_ID && SES_SECRET_ACCESS_KEY && MAIL_FROM) {
    return createSesSender({ region: SES_REGION, accessKeyId: SES_ACCESS_KEY_ID, secretAccessKey: SES_SECRET_ACCESS_KEY, from: MAIL_FROM });
  }
  return null;
}

/** Último resultado de envio neste processo: o health mostra "falhou" se o último envio deu erro (revisão da S2). */
let lastSend: { ok: boolean; at: number } | null = null;
export function noteSendResult(ok: boolean, now = Date.now()): void {
  lastSend = { ok, at: now };
}

export function mailConfigured(env: NodeJS.ProcessEnv = process.env, now = Date.now()): "configurado" | "memoria" | "ausente" | "falhou" {
  const s = getMailSender(env);
  if (!s) return "ausente";
  if (s.kind !== "ses") return "memoria";
  return lastSend && !lastSend.ok && now - lastSend.at < 6 * 3_600_000 ? "falhou" : "configurado";
}
