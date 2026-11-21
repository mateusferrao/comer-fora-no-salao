/** HMAC do telefone, assinatura de cookies e hash de aparelho (servidor). */
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
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

/**
 * S4 (D169): e-mail do cliente com finalidade própria (`cliente-email:`), para não casar com o HMAC do dono.
 */
export function hmacCustomerEmail(normalizedEmail: string): string {
  return createHmac("sha256", getSecret("SESSION_SECRET")).update(`cliente-email:${normalizedEmail}`).digest("hex");
}

/** Chave AES-256 derivada do SESSION_SECRET por HKDF (finalidade própria; sem variável nova no ambiente) [C]. */
function piiKey(purpose: "email-enc:v1" | "telefone-enc:v1"): Buffer {
  return Buffer.from(hkdfSync("sha256", getSecret("SESSION_SECRET"), "comer-fora-no-salao", purpose, 32));
}

function encrypt(purpose: "email-enc:v1" | "telefone-enc:v1", text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", piiKey(purpose), iv);
  const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

function decrypt(purpose: "email-enc:v1" | "telefone-enc:v1", enc: string | null | undefined): string | null {
  if (!enc) return null;
  const [v, iv, tag, ct] = enc.split(".");
  if (v !== "v1" || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", piiKey(purpose), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** `v1.iv.tag.cifra` (base64url). Envio de e-mails e, desde D237, a tela do dono (contato completo do cliente). */
export const encryptEmail = (email: string) => encrypt("email-enc:v1", email);
export const decryptEmail = (enc: string | null | undefined) => decrypt("email-enc:v1", enc);

/** Telefone do cliente cifrado (D237): só o dono do restaurante vê, decifrado na hora; chave separada da do e-mail. */
export const encryptPhone = (phone: string) => encrypt("telefone-enc:v1", phone);
export const decryptPhone = (enc: string | null | undefined) => decrypt("telefone-enc:v1", enc);
