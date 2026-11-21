/**
 * Referências nos textos da IA (D54, D206; módulo único — revisão T-I3): a IA escreve `{fato:chave}`,
 * `{prato:id}`, `{horario:slotId}`, `{oferta}`, `{beneficio}`, `{recompensa}`; o código troca pelos textos
 * (números, nomes de pratos, horários e ofertas são sempre do código).
 */
export const REF_KINDS = ["fato", "prato", "horario", "oferta", "beneficio", "recompensa"] as const;
export type RefKind = (typeof REF_KINDS)[number];
export type Ref = { kind: RefKind; key: string };

const REF_RE = /\{(fato|prato|horario):([^{}\s]+)\}|\{(oferta|beneficio|recompensa)\}/g;

export type RefContext = {
  facts?: Record<string, number | string>;
  /** id do item → nome (o código limpou os nomes antes). */
  items?: Record<string, string>;
  /** id da faixa → "Ter, Qua · 15h–18h" (no 2º card, vem do snapshot congelado do convite — D218). */
  slots?: Record<string, string>;
  oferta?: string;
  beneficio?: string;
  recompensa?: string;
};

export function referencesIn(text: string): Ref[] {
  const out: Ref[] = [];
  for (const m of text.matchAll(REF_RE)) out.push(m[3] ? { kind: m[3] as RefKind, key: "" } : { kind: m[1] as RefKind, key: m[2]! });
  return out;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const INT = new Intl.NumberFormat("pt-BR");

/** Convenção dos fatos: `_pct` → "65%"; `ticket_medio`/`_centavos` → reais; números → pt-BR. */
const CATEGORY: Record<string, [string, string]> = {
  entrada: ["entrada", "entradas"],
  prato: ["prato", "pratos"],
  porcao: ["porção", "porções"],
  sobremesa: ["sobremesa", "sobremesas"],
  bebida: ["bebida", "bebidas"],
};

/** Unidade dos fatos declarados (revisão da S2: "atrair as 4 … no 15 do salão" — número solto sem unidade). */
function withUnit(key: string, n: number): string {
  const v = INT.format(n);
  if (key === "mesas_total" || /^faixa_[A-H]_mesas$/.test(key)) return `${v} ${n === 1 ? "mesa" : "mesas"}`;
  if (key === "clientes_semana") return `${v} ${n === 1 ? "cliente" : "clientes"} por semana`;
  // S3: fatos do plano da semana (insights do código).
  if (/^convites/.test(key)) return `${v} ${n === 1 ? "convite" : "convites"}`;
  if (/^checkins/.test(key)) return `${v} ${n === 1 ? "check-in" : "check-ins"}`;
  if (/^(clientes_30d|segmento_)/.test(key)) return `${v} ${n === 1 ? "cliente" : "clientes"}`;
  const cat = CATEGORY[/^itens_([a-z]+)$/.exec(key)?.[1] ?? ""];
  if (cat) return `${v} ${n === 1 ? cat[0] : cat[1]}`;
  return v;
}

export function formatFact(key: string, value: number | string): string {
  if (typeof value === "string") return value;
  if (key.endsWith("_pct")) return `${INT.format(Math.round(value))}%`;
  if (key === "ticket_medio" || key.endsWith("_centavos")) return BRL.format(value / 100).replace(/ /g, " ");
  return withUnit(key, value);
}

function resolve(r: Ref, ctx: RefContext): string | undefined {
  switch (r.kind) {
    case "fato": {
      const v = ctx.facts?.[r.key];
      return v === undefined ? undefined : formatFact(r.key, v);
    }
    case "prato":
      return ctx.items?.[r.key];
    case "horario":
      return ctx.slots?.[r.key];
    default:
      return ctx[r.kind];
  }
}

/** Troca as referências pelos textos do código; `{fato:x_pct}%` (convenção antiga) não duplica o "%". */
export function renderReferences(text: string, ctx: RefContext): string {
  return text
    .replace(REF_RE, (whole, k1: string | undefined, key: string | undefined, k2: string | undefined) => {
      const r: Ref = k2 ? { kind: k2 as RefKind, key: "" } : { kind: k1 as RefKind, key: key! };
      return resolve(r, ctx) ?? "";
    })
    .replace(/%%/g, "%");
}

/** Referências que não existem no contexto ou não são permitidas no campo. */
export function unknownRefs(text: string, ctx: RefContext, allowed: readonly RefKind[]): string[] {
  const bad: string[] = [];
  for (const r of referencesIn(text)) {
    if (!allowed.includes(r.kind)) bad.push(`${r.kind}${r.key ? `:${r.key}` : ""} (não permitida aqui)`);
    else if (resolve(r, ctx) === undefined) bad.push(`${r.kind}${r.key ? `:${r.key}` : ""}`);
  }
  return bad;
}

export function stripReferences(text: string): string {
  return text.replace(REF_RE, "");
}
