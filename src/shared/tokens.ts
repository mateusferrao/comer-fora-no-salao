/**
 * Tokens de acesso guardados só como SHA-256 (MCP — D219; link do garçom — D190; "Revisar e aprovar" — D187):
 * 32 bytes aleatórios em base64url com prefixo, mostrados uma vez; comparação do hash em tempo constante.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export function newToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

/** Formato plausível antes de ir ao banco (prefixo e tamanho): evita consulta com lixo. */
export function plausibleToken(token: string | null | undefined, prefix: string): token is string {
  return !!token && token.startsWith(prefix) && token.length >= 40 && token.length <= 80 && /^[A-Za-z0-9_-]+$/.test(token.slice(prefix.length));
}

export function sameHash(stored: string, computed: string): boolean {
  const a = Buffer.from(stored);
  const b = Buffer.from(computed);
  return a.length === b.length && timingSafeEqual(a, b);
}
