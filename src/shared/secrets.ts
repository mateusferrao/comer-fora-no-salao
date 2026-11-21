/**
 * Segredos só do ambiente (espec. 4.6). Leitura preguiçosa: nunca no import (o `next build` não tem os segredos).
 * Em produção, faltar é erro; em desenvolvimento e testes, usa um valor fixo de desenvolvimento.
 */
export type SecretName = "PHONE_HASH_SECRET" | "SESSION_SECRET";

const DEV_FALLBACK: Record<SecretName, string> = {
  PHONE_HASH_SECRET: "dev-phone-hash-secret-nao-usar-em-producao",
  SESSION_SECRET: "dev-session-secret-nao-usar-em-producao",
};

export class MissingSecretError extends Error {
  constructor(name: SecretName) {
    super(`segredo ${name} não configurado`);
  }
}

export function getSecret(name: SecretName, env: Record<string, string | undefined> = process.env): string {
  const v = env[name];
  if (v && v.length >= 16) return v;
  if (env.NODE_ENV === "production") throw new MissingSecretError(name);
  return DEV_FALLBACK[name];
}
