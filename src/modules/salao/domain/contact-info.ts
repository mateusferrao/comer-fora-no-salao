/**
 * D174: texto escrito pelo dono com link, e-mail ou telefone não sai por e-mail (vai só para o app), para o
 * remetente compartilhado (D135, D175) não servir de canal de golpe.
 */
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|app|br|site|online|xyz|info|me|link|ly)\b/i;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_RE = /(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}/;

export function hasContactInfo(text: string): boolean {
  return URL_RE.test(text) || EMAIL_RE.test(text) || PHONE_RE.test(text);
}
