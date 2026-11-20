/**
 * Regras fixas dos textos (guardrail camada 2 — espec. 4.4; planejamento S2 §4.5). Funções puras.
 * Texto da IA: tudo bloqueia. Texto do dono (D125): números e palavras proibidas só avisam; referência
 * desconhecida, PII, HTML e tamanho continuam bloqueando.
 */
import { renderReferences, stripReferences, unknownRefs, referencesIn, type RefContext, type RefKind } from "@/src/modules/textos/domain/references";

export type GuardField = "textoConvite" | "justificativa" | "aprendemos" | "kit";
export type GuardOptions = {
  allowed: readonly RefKind[];
  maxLen: number;
  field: GuardField;
  mode: "ia" | "dono";
  /** Kit: o texto vai para todos (inclusive o holdout) → nada de dia, turno nem item do convite. */
  forbidDayTurn?: boolean;
  forbidItemIds?: readonly string[];
};
export type TextGuard = { ok: true; warnings: string[] } | { ok: false; reasons: string[]; warnings: string[] };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lista [C]: promessas e números escritos por extenso que o código não controla. */
export const FORBIDDEN = ["gratis", "de graca", "metade", "dobro", "garantid", "melhor do", "o melhor", "ultimas", "so hoje", "imperdivel", "ifood paga", "reais", "r$"];
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
  for (const w of FORBIDDEN) if (hasWord(n, w)) soft(`proibida:${w}`);
  if (o.field === "textoConvite") for (const w of CONVITE_ONLY) if (hasWord(n, w)) soft(`proibida:${w}`);
  if (o.forbidDayTurn) for (const w of DAY_TURN) if (hasWord(n, w)) reasons.push(`dia_turno:${w}`);
  if (o.forbidItemIds?.length) {
    for (const r of referencesIn(text)) if (r.kind === "prato" && o.forbidItemIds.includes(r.key)) reasons.push(`item_do_convite:${r.key}`);
  }
  const rendered = renderReferences(text, ctx).trim();
  if (!rendered) reasons.push("vazio");
  if (rendered.length > o.maxLen) reasons.push(`tamanho:${rendered.length}>${o.maxLen}`);
  return reasons.length ? { ok: false, reasons, warnings } : { ok: true, warnings };
}
