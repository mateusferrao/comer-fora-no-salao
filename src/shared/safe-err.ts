/**
 * Descrição segura de um erro para log: nome + código (do driver), nunca a mensagem.
 * A mensagem de erro do Drizzle inclui a consulta e os parâmetros (nome, HMAC, 4 dígitos) — revisão S1, A2.
 */
export function safeErr(err: unknown): string {
  if (!(err instanceof Error)) return "erro";
  const cause = (err as { cause?: { code?: unknown } }).cause;
  const code = (err as { code?: unknown }).code ?? cause?.code;
  return code ? `${err.name} (${String(code)})` : err.name;
}
