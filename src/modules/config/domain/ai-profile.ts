/**
 * "IA do restaurante" (S6.3a — D197): "Fatos para a IA" e "O que evitar", opcionais (vazio = prompt padrão) e
 * seguros. A defesa principal é estrutural (dado delimitado no conteúdo do usuário, nunca no `system`; schema preso
 * às candidatas; guardrails; revisor; aprovação humana). Aqui, na gravação: limpeza, tamanho, sem marcação, sem
 * contato/PII e — só nos fatos — sem frases de sequestro de instrução (com limite de palavra, para não recusar
 * "assistente de cozinha" ou "para você e sua família" — revisão técnica I2).
 */
export const ABOUT_MAX = 500;
export const AVOID_MAX = 200;
export const AVOID_TERMS_MAX = 15;
export type AboutError = "longo" | "caracteres" | "contato" | "instrucao";
export type AvoidError = "longo" | "caracteres" | "contato" | "termos";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** NFC, sem caracteres de controle nem de largura zero, espaços colapsados (quebra de linha vira espaço). */
export function cleanOwnerText(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[​-‍⁠﻿]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Marcadores conferidos também na forma NFKC (revisão S4–S6, segurança 6: ＜ ＞ ｛ ｝ de largura total). */
const MARKUP = /[{}<>«»`]|\[\[|\]\]|#{3}|dados_do_dono/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const URL = /(https?:\/\/|www\.|\.com\b|\.com\.br\b|\.br\b|\.net\b|\.org\b)/i;
const PHONE = /(?:\d[\s.()-]?){8,}/;
const CPF = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/;
const hasContact = (t: string) => EMAIL.test(t) || URL.test(t) || PHONE.test(t) || CPF.test(t);

/** Frases de sequestro de instrução (texto sem acento, minúsculo), sempre com limite de palavra. */
const HIJACK = [
  /\bignor(e|a|ar|em)\b[^.]{0,30}\b(instruc|regra|orientac|comando)/,
  /\bdesconsider(e|a|ar|em)\b[^.]{0,30}\b(instruc|regra|orientac|tudo|acima|anterior)/,
  /\besquec(a|er|am)\b[^.]{0,30}\b(instruc|regra|tudo)/,
  /\bvoce\s+(e|agora\s+e|sera)\s+(um|uma)\s+(ia|assistente|modelo|chatbot|robo|bot|vendedor|vendedora)\b/,
  /\ba partir de agora\s+(voce|responda|escreva|ignore|aja|use|fale)\b/,
  /\bsystem\s*prompt\b|\bprompt\s+do\s+sistema\b|\binstruc(ao|oes)\s+do\s+sistema\b/,
  /\baja\s+como\s+(um|uma|se)\b/,
  /\bnovas?\s+(instruc\w*|regras)\b/,
  /\bregras\s+novas\b/,
  /\bmodelo\s+de\s+linguagem\b/,
  /\bresponda\s+(apenas|somente|so)\s+(com|em)\b/,
];

export function validateAbout(raw: string): { ok: true; about: string | null } | { ok: false; erro: AboutError } {
  const t = cleanOwnerText(raw);
  if (!t) return { ok: true, about: null };
  if (t.length > ABOUT_MAX) return { ok: false, erro: "longo" };
  if (MARKUP.test(raw.normalize("NFKC"))) return { ok: false, erro: "caracteres" };
  if (hasContact(t)) return { ok: false, erro: "contato" };
  const f = fold(t);
  if (/;\s*(drop|delete|insert|update|select)\b|--\s*$/.test(f)) return { ok: false, erro: "caracteres" };
  if (HIJACK.some((r) => r.test(f))) return { ok: false, erro: "instrucao" };
  return { ok: true, about: t };
}

/** Termos de "O que evitar" (separados por vírgula, ponto e vírgula ou quebra de linha). */
export function avoidTerms(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return cleanOwnerText(raw.replace(/[;\n\r]/g, ","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateAvoid(raw: string): { ok: true; avoid: string | null; terms: string[] } | { ok: false; erro: AvoidError } {
  if (MARKUP.test(raw.normalize("NFKC"))) return { ok: false, erro: "caracteres" };
  const terms = avoidTerms(raw);
  if (!terms.length) return { ok: true, avoid: null, terms: [] };
  const joined = terms.join(", ");
  if (joined.length > AVOID_MAX) return { ok: false, erro: "longo" };
  if (hasContact(joined)) return { ok: false, erro: "contato" };
  if (terms.length > AVOID_TERMS_MAX || terms.some((t) => t.length < 2 || t.length > 30)) return { ok: false, erro: "termos" };
  return { ok: true, avoid: joined, terms };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 1º termo de "O que evitar" presente no texto (palavra inteira nas duas pontas, sem acento nem caixa) ou null. */
export function findAvoided(text: string, terms: readonly string[]): string | null {
  if (!terms.length) return null;
  const t = fold(text);
  for (const term of terms) {
    const pat = fold(term).trim().split(/\s+/).map(escape).join("\\s+");
    if (pat && new RegExp(`(^|[^a-z0-9])${pat}($|[^a-z0-9])`).test(t)) return term;
  }
  return null;
}

/** Dados do dono para o prompt (vazio = nada muda). */
export function ownerDataOf(r: { aiAbout?: string | null; aiAvoid?: string | null }): { about: string | null; avoid: string[] } {
  return { about: r.aiAbout ?? null, avoid: avoidTerms(r.aiAvoid) };
}

/** Liga/desliga por restaurante (D197): agente e "aprender com minhas edições"; padrão ligado. O revisor não entra. */
export type AiFeatures = { agente: boolean; aprende: boolean };
export function parseAiFeatures(raw: unknown): AiFeatures {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return { agente: typeof o.agente === "boolean" ? o.agente : true, aprende: typeof o.aprende === "boolean" ? o.aprende : true };
}
