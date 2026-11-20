/** HMAC do telefone, assinatura de cookies e hash de aparelho (servidor). */
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getSecret } from "./secrets";

/** Telefone guardado só como HMAC-SHA256 (segredo `PHONE_HASH_SECRET`) — espec. 4.6. */
export function hmacPhone(digits: string): string {
  return createHmac("sha256", getSecret("PHONE_HASH_SECRET")).update(digits).digest("hex");
}

function sign(value: string): string {
  return createHmac("sha256", getSecret("SESSION_SECRET")).update(value).digest("base64url");
}

/** `valor.assinatura` (o valor não é segredo; a assinatura impede trocar de cliente). */
export function signValue(value: string): string {
  return `${value}.${sign(value)}`;
}

export function verifySigned(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  const given = Buffer.from(signed.slice(i + 1));
  const expected = Buffer.from(sign(value));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return value;
}

export function hashDevice(deviceId: string): string {
  return createHash("sha256").update(`aparelho:${deviceId}`).digest("hex").slice(0, 32);
}

/** Inteiro uniforme em [0, n) sem viés (códigos em produção). */
export const secureRandInt = (n: number) => randomInt(n);

/** E-mail do dono (D118): HMAC com finalidade própria; o e-mail em claro nunca é gravado. */
export function hmacEmail(normalizedEmail: string): string {
  return createHmac("sha256", getSecret("SESSION_SECRET")).update(`email:${normalizedEmail}`).digest("hex");
}

/** Código de login guardado como HMAC amarrado ao e-mail (não serve para outra conta). */
export function hmacLoginCode(emailHmac: string, code: string): string {
  return createHmac("sha256", getSecret("SESSION_SECRET")).update(`login:${emailHmac}:${code}`).digest("hex");
}

/** Comparação em tempo constante de segredos de tamanho variável (tokens do E2E e do link do avaliador). */
export function safeEqual(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) && given.length === expected.length;
}
