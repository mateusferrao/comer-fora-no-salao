/**
 * Porta de envio de e-mail (extensão registrada da D45 — D130): SES real em produção e transporte em
 * memória só quando `MAIL_TRANSPORT=memory` (CI e local). Nunca loga o endereço.
 */
export type MailMessage = { to: string; subject: string; text: string; html: string };

export interface MailSender {
  readonly kind: "ses" | "memory";
  send(msg: MailMessage): Promise<void>;
}

export class MailError extends Error {
  constructor(readonly status?: number) {
    super(`falha no envio de e-mail${status ? ` (HTTP ${status})` : ""}`);
    this.name = "MailError";
  }
}
