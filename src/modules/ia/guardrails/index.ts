/**
 * Regras fixas dos textos (guardrail camada 2 — espec. 4.4; planejamento S2 §4.5). Funções puras.
 * Texto da IA: tudo bloqueia. Texto do dono (D125): números e palavras proibidas só avisam; referência
 * desconhecida, PII, HTML e tamanho continuam bloqueando.
 */
import { renderReferences, stripReferences, unknownRefs, referencesIn, type RefContext, type RefKind } from "@/src/modules/textos/domain/references";
import { findAvoided } from "@/src/modules/config/domain/ai-profile";

export type GuardField = "textoConvite" | "justificativa" | "aprendemos" | "kit" | "chat";
export type GuardOptions = {
  allowed: readonly RefKind[];
  maxLen: number;
  field: GuardField;
  mode: "ia" | "dono";
  /** Kit: o texto vai para todos (inclusive o holdout) → nada de dia, turno nem item do convite. */
  forbidDayTurn?: boolean;
  forbidItemIds?: readonly string[];
  /** "O que evitar" do dono (S6.3a — D197): termo presente bloqueia o texto da IA; no texto do dono, só avisa. */
  avoid?: readonly string[];
  /**
   * Convite (D226): a chave da faixa cujo `{horario:…}` o texto PRECISA citar. Liga também as regras de redação
   * `artigo_antes_do_horario` e `oferta_repetida` (críticas do juiz na T3 do agente, agora determinísticas).
   */
  requireSlot?: string;
  /** S8: lista de palavras proibidas do campo (padrão: `FORBIDDEN`, feita para textos de marketing). */
  forbidden?: readonly string[];
};
export type TextGuard = { ok: true; warnings: string[] } | { ok: false; reasons: string[]; warnings: string[] };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lista [C]: promessas e números escritos por extenso que o código não controla. */
export const FORBIDDEN = ["gratis", "de graca", "metade", "dobro", "garantid", "melhor do", "o melhor", "ultimas", "so hoje", "imperdivel", "ifood paga", "reais", "r$"];
/**
 * Chat do copiloto (S8 — D264, [C]): o texto explica regras e ofertas ao dono, então "grátis" e "melhor" podem aparecer;
 * continuam proibidas as promessas de dinheiro e de marca e os números por extenso.
 */
export const CHAT_FORBIDDEN = ["metade", "dobro", "garantid", "ifood paga", "reais", "r$"];
/** Números por extenso (S8): a IA não escreve número, nem em palavras ("um/uma" ficam de fora: são artigos). */
const NUMBER_WORDS = ["dois", "duas", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa", "cem", "cento", "duzentos", "trezentos", "quinhentos", "mil", "milhao", "milhoes", "dezena", "duzia"];
/** Multiplicadores (S9, A1): "dobrar", "triplicar"… são número disfarçado; casam pelo começo da palavra. */
const MULTIPLIERS = ["dobrar", "duplic", "triplic", "quadruplic", "quintuplic", "triplo", "quadruplo"];
/**
 * Promessa extra que o código não controla (S9, A1), só no convite e no kit: "de brinde", "por conta da casa".
 * "cortesia" fica de fora: é o nome de um tipo de oferta.
 */
const EXTRA_PROMISE = ["brinde", "por conta da casa"];
const URL_RE = /https?:\/\/|www\.|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|br|net|org|io|app|me|ly|info|site|online|link|xyz)\b/i;
const CONVITE_ONLY = ["desconto"];
const DAY_TURN = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo", "manha", "tarde", "noite", "almoco", "jantar", "madrugada", "happy hour", "fim de semana"];

function hasWord(text: string, w: string): boolean {
  const esc = w.replace(/[.*+?^${}()|[\]\\$]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}`, "i").test(text);
}

const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE = /(?:\d[\s.-]?){8,}/;
const CPF = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/;

export function guardText(text: string, ctx: RefContext, o: GuardOptions): TextGuard {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const soft = (r: string) => (o.mode === "dono" ? warnings : reasons).push(r);

  for (const u of unknownRefs(text, ctx, o.allowed)) reasons.push(`referencia:${u}`);
  const bare = stripReferences(text);
  if (/[<>]|[{}]/.test(bare)) reasons.push("formato");
  if (EMAIL.test(bare) || PHONE.test(bare) || CPF.test(bare)) reasons.push("pii");
  if (/\d/.test(bare) || bare.includes("%")) soft("numero");
  const n = norm(bare);
  for (const w of o.forbidden ?? FORBIDDEN) if (hasWord(n, w)) soft(`proibida:${w}`);
  // S9 (A1): número por extenso vale em todo texto da IA (convite, kit, justificativa, aprendemos, chat); as
  // referências já saíram (`bare`), então o nome de um prato citado por {prato:…} não conta.
  if (o.field === "chat" || o.mode === "ia") {
    for (const w of NUMBER_WORDS) if (new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(n)) soft(`numero_extenso:${w}`);
    if (/(^|[^a-z0-9])por cento([^a-z0-9]|$)/.test(n)) soft("numero_extenso:por cento");
    for (const w of MULTIPLIERS) if (hasWord(n, w)) soft(`numero_extenso:${w}`);
  }
  if (o.field === "chat" && URL_RE.test(bare)) reasons.push("url");
  if (o.field === "textoConvite" || o.field === "kit") for (const w of EXTRA_PROMISE) if (hasWord(n, w)) soft(`proibida:${w}`);
  if (o.field === "textoConvite") for (const w of CONVITE_ONLY) if (hasWord(n, w)) soft(`proibida:${w}`);
  if (o.requireSlot !== undefined) for (const r of conviteReasons(text, o.requireSlot)) soft(r);
  // Sem as referências: o nome de um prato citado por {prato:…} não conta como uso do termo.
  const avoided = findAvoided(bare, o.avoid ?? []);
  if (avoided) soft(`evitar:${avoided}`);
  if (o.forbidDayTurn) for (const w of DAY_TURN) if (hasWord(n, w)) reasons.push(`dia_turno:${w}`);
  if (o.forbidItemIds?.length) {
    for (const r of referencesIn(text)) if (r.kind === "prato" && o.forbidItemIds.includes(r.key)) reasons.push(`item_do_convite:${r.key}`);
  }
  const rendered = renderReferences(text, ctx).trim();
  if (!rendered) reasons.push("vazio");
  if (rendered.length > o.maxLen) reasons.push(`tamanho:${rendered.length}>${o.maxLen}`);
  return reasons.length ? { ok: false, reasons, warnings } : { ok: true, warnings };
}

/**
 * Regras determinísticas do convite (D226), sobre o texto com as referências:
 * - `sem_horario`: não cita o `{horario:X}` da própria faixa (o convite perde o sentido sem dia e horário);
 * - `artigo_antes_do_horario`: "no/na/nos/nas/em {horario:…}" ("Volte no terça…");
 * - `oferta_repetida`: logo depois de `{oferta}` vem "grátis", "de graça", "por (nossa) conta" ou um `{prato:…}`
 *   (a oferta renderizada já diz o benefício inteiro).
 */
export function conviteReasons(text: string, slotKey: string): string[] {
  const out: string[] = [];
  const esc = slotKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`\\{horario:${esc}\\}`).test(text)) out.push("sem_horario");
  if (/(^|[^a-zà-ú])(no|na|nos|nas|em)\s+\{horario:/i.test(text)) out.push("artigo_antes_do_horario");
  if (/\{oferta\}\s*(gr[aá]tis|de gra[cç]a|por (nossa |minha )?conta|\{prato:)/i.test(text)) out.push("oferta_repetida");
  return out;
}
