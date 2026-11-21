/**
 * Login do dono por e-mail real + código de 6 dígitos (D118). Regras puras: o e-mail só circula
 * normalizado e, no banco, vira HMAC (aplicação); aqui não há segredo nem relógio solto.
 */
import { z } from "zod";

export const LOGIN_CODE_TTL_MIN = 10;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;
export const LOGIN_CODE_LENGTH = 6;

/** E-mails de teste do E2E (D123): só valem com o token secreto no cabeçalho. */
export const E2E_EMAIL_RE = /^e2e-dono\+\d{1,4}@exemplo\.invalid$/;

const emailSchema = z.email().max(254);

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** E-mail normalizado ou `null` se o formato não servir. */
export function parseEmail(raw: string): string | null {
  const e = normalizeEmail(raw);
  if (E2E_EMAIL_RE.test(e)) return e;
  return emailSchema.safeParse(e).success ? e : null;
}

/** "maria@dominio.com" → "m•••@d•••.com" (dica para a tela e o rodapé; nunca o e-mail inteiro). */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const dot = domain.indexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${user.slice(0, 1)}•••@${host.slice(0, 1)}•••${tld}`;
}

export function generateLoginCode(randInt: (n: number) => number): string {
  let s = "";
  for (let i = 0; i < LOGIN_CODE_LENGTH; i++) s += String(randInt(10));
  return s;
}

export function isLoginCodeFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export type LoginCodeRow = { expiresAt: Date; attempts: number; usedAt: Date | null };
export type LoginCodeState = "valido" | "expirado" | "bloqueado" | "usado" | "ausente";

export function loginCodeState(row: LoginCodeRow | null, now: Date): LoginCodeState {
  if (!row) return "ausente";
  if (row.usedAt) return "usado";
  if (row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return "bloqueado";
  if (row.expiresAt.getTime() < now.getTime()) return "expirado";
  return "valido";
}
