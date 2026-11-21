/**
 * Nome de restaurante não pode citar a marca iFood (revisão S4–S6, aderência 3): o nome vai no assunto e no corpo
 * dos e-mails que saem do nosso domínio ("iFood Suporte" viraria phishing). Sem acento, sem caixa, com ou sem
 * espaço/hífen ("i-food", "i food"); "Wi-Fi Food" não casa.
 */
export function mentionsIfood(name: string): boolean {
  const s = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  return /\bi ?food/.test(s);
}
