/**
 * Telefone do cliente: qualquer número no formato `(DD) 9XXXX-XXXX` (D106 — sem checar se é real, de propósito).
 * Guardado só como HMAC + 4 últimos dígitos.
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
