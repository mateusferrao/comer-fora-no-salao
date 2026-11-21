/**
 * Tom da IA do restaurante (D138): texto curto do dono que entra como DADO delimitado no prompt (nunca no `system`).
 * Defesas: tamanho, sem chaves/ângulos (referências e marcação), sem URL, sem quebra de linha, sem as palavras
 * proibidas da lista de guardrails.
 */
export const TONE_MAX = 200;
export type ToneError = "longo" | "caracteres" | "url" | "proibida" | "dados";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function validateTone(raw: string, forbidden: readonly string[]): { ok: true; tone: string | null } | { ok: false; erro: ToneError } {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return { ok: true, tone: null };
  if (t.length > TONE_MAX) return { ok: false, erro: "longo" };
  // «» fecham o delimitador do prompt; chaves e ângulos viram referência ou marcação.
  if (/[{}<>«»\n\r]/.test(raw)) return { ok: false, erro: "caracteres" };
  // Nada de e-mail ou número longo (telefone, documento) no prompt: PII fica fora da IA (espec. 4.6).
  if (/@|\d{4,}/.test(t.replace(/[\s.()-]/g, ""))) return { ok: false, erro: "dados" };
  if (/(https?:\/\/|www\.|\.com\b|\.br\b)/i.test(t)) return { ok: false, erro: "url" };
  const n = norm(t);
  if (forbidden.some((w) => n.includes(w))) return { ok: false, erro: "proibida" };
  return { ok: true, tone: t };
}

/** Tom já validado, pronto para o prompt (até 200 caracteres; sem delimitadores). */
export function toneForPrompt(tone: string): string {
  return tone.replace(/[{}<>«»\n\r]/g, "").replace(/\s+/g, " ").trim().slice(0, TONE_MAX);
}
