/**
 * Telefone do cliente: qualquer número no formato `(DD) 9XXXX-XXXX` (D106 — sem checar se é real, de propósito).
 * Guardado como HMAC + 4 últimos dígitos e, desde D237, cifrado inteiro (o dono vê o contato completo).
 */
export const PHONE_PATTERN = /^\(\d{2}\) 9\d{4}-\d{4}$/;

export function isPhoneFormat(v: string): boolean {
  return PHONE_PATTERN.test(v);
}

export function phoneDigits(v: string): string {
  return v.replace(/\D/g, "");
}

export function formatPhone(digits: string): string {
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function last4(v: string): string {
  return phoneDigits(v).slice(-4);
}

/** Máscara progressiva enquanto digita: "(00) 91234-5678". */
export function maskPhone(input: string): string {
  const d = phoneDigits(input).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Contato fictício óbvio dos clientes simulados (D237): DDD 00 (não existe) com os mesmos 4 últimos dígitos, e e-mail
 * em `exemplo.invalid` (domínio reservado, nunca entrega). `seed` (id do cliente) fixa os dígitos do meio.
 */
const hash = (seed: string) => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

export function fakePhone(seed: string, lastDigits: string): string {
  const mid = String(hash(seed) % 10000).padStart(4, "0");
  return formatPhone(`009${mid}${lastDigits.padStart(4, "0").slice(-4)}`);
}

export function fakeEmail(name: string, seed: string): string {
  const base =
    name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "") || "cliente";
  // Sufixo pelo id inteiro (não pelo começo dele: ids simulados podem repetir o prefixo).
  return `${base}.${hash(seed).toString(36).padStart(6, "0").slice(-6)}@exemplo.invalid`;
}
