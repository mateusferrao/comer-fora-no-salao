import type { MailMessage, MailSender } from "./mail-sender";

type G = { __salaoOutbox?: MailMessage[] };
const g = globalThis as typeof globalThis & G;

/** Caixa de saída em memória (testes e desenvolvimento). Só ligada com `MAIL_TRANSPORT=memory`. */
export const memorySender: MailSender = {
  kind: "memory",
  async send(msg) {
    (g.__salaoOutbox ??= []).push(msg);
  },
};

export function outbox(): MailMessage[] {
  return (g.__salaoOutbox ??= []);
}

export function clearOutbox(): void {
  g.__salaoOutbox = [];
}
