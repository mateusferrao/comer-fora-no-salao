/**
 * D174: texto escrito pelo dono com link, e-mail ou telefone não sai por e-mail (vai só para o app), para o
 * remetente compartilhado (D135, D175) não servir de canal de golpe. Vale também para o nome do restaurante e do prato
 * (S9, M1). Revisão S9: contato disfarçado também conta (dígitos separados, "@perfil", "arroba", "zap", domínio curto).
 */
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|app|br|site|online|xyz|info|me|link|ly)\b/i;
/** Domínio com ponto e TLD de 2 letras ou comum ("linktr.ee/x", "bit.ly"): só em minúsculas, como se digita um link. */
const DOMAIN_RE = /(^|[^\p{L}\p{N}.])[a-z0-9-]{2,}\.(?:[a-z]{2}|bio|shop|store|page|club|top|biz|live|dev|tv)(?=$|[/\s,;:!?)])/u;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_RE = /(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}/;
/** Telefone com os dígitos separados ("11 9 87 65 43 21", "11.98765.4321"): 8+ dígitos só com espaço, ponto, hífen ou parêntese. */
const SPLIT_PHONE_RE = /\d(?:[\s.()-]*\d){7,}/;
const HANDLE_RE = /@\w{3,}/;
/** Palavras de contato e de link ditas por extenso (comparadas sem acento e sem caixa). */
const CONTACT_WORDS = /(^|[^a-z0-9])(zap|zapzap|whats|whatsapp|wpp|insta|instagram|telegram|arroba|ponto com|ponto br|ponto net)([^a-z0-9]|$)/;
const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

export function hasContactInfo(text: string): boolean {
  return URL_RE.test(text) || DOMAIN_RE.test(text) || EMAIL_RE.test(text) || PHONE_RE.test(text) || SPLIT_PHONE_RE.test(text) || HANDLE_RE.test(text) || CONTACT_WORDS.test(norm(text));
}
