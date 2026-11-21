/**
 * Contato do cliente para quem tem direito de ver (dono do restaurante, garçom dele, o próprio cliente) — D237:
 * nome completo, telefone e e-mail inteiros, decifrados na hora. Nunca vai para log, prompt, MCP nem rastro (D161).
 */
import { decryptEmail, decryptPhone } from "./crypto";

export type ContactRow = { name?: string | null; phoneEnc?: string | null; phoneLast4?: string | null; emailEnc?: string | null };
export type Contact = { name: string; phone: string; email: string };

/** Nome como o cliente escreveu; sem nome (perfil pendente ou dados apagados) → "Cliente". */
export function fullName(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ") || "Cliente";
}

export function contactOf(r: ContactRow): Contact {
  const phone = decryptPhone(r.phoneEnc) ?? (r.phoneLast4 ? `•••• ${r.phoneLast4} (número antigo)` : "—");
  return { name: fullName(r.name), phone, email: decryptEmail(r.emailEnc) ?? "—" };
}
