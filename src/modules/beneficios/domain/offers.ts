/**
 * Ofertas polimórficas (espec. 3.3: "benefício e convite como tipo polimórfico").
 * Cada tipo tem contrato próprio: schema, validação contra o cardápio, descrição e custo.
 * Os textos são do código; a IA nunca escreve número, prato ou benefício.
 */
import { z } from "zod";
import { averagePriceCents, findItem, type MenuCategory, type MenuItem } from "./menu";

export const OFFER_KINDS = ["leve2pague1", "desconto", "doce_gratis", "entrada_gratis", "cortesia"] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];
export type Role = "agora" | "convite" | "recompensa";

export const MAX_DISCOUNT_PCT = 50;

const base = z.object({ itemId: z.string().min(1), minSpendCents: z.number().int().positive().optional() });
const discountParams = base.extend({ pct: z.number().int().min(1).max(100) });

export type OfferParams = z.infer<typeof base> & { pct?: number };
export type Offer = { kind: OfferKind; params: OfferParams };
export type OfferError = "parametros_invalidos" | "item_inexistente" | "categoria_incompativel" | "desconto_acima_do_teto" | "item_fora_das_ofertas";
export type OfferText = { title: string; subtitle: string; itemName: string; gain: string };

export interface OfferStrategy {
  kind: OfferKind;
  schema: z.ZodType<OfferParams>;
  categories: readonly MenuCategory[] | "todas";
  title(p: OfferParams): string;
  gain(p: OfferParams, itemName: string): string;
  /** Custo para o restaurante de 1 uso, dado o preço do item (centavos). */
  cost(p: OfferParams, priceCents: number, marginPct?: number): { cents: number; isMax: boolean };
}

const itemCost = (_p: OfferParams, price: number, margin?: number) =>
  margin === undefined ? { cents: price, isMax: true } : { cents: Math.round(price * (1 - margin / 100)), isMax: false };

const free = (kind: OfferKind, title: string, categories: readonly MenuCategory[]): OfferStrategy => ({
  kind,
  schema: base,
  categories,
  title: () => title,
  gain: (_p, item) => `${item} grátis`,
  cost: itemCost,
});

export const offerRegistry: Record<OfferKind, OfferStrategy> = {
  doce_gratis: free("doce_gratis", "Doce grátis", ["sobremesa"]),
  entrada_gratis: free("entrada_gratis", "Entrada grátis", ["entrada", "porcao"]),
  cortesia: free("cortesia", "Ganhe cortesia", ["bebida", "sobremesa"]),
  leve2pague1: {
    kind: "leve2pague1",
    schema: base,
    categories: "todas",
    title: () => "Leve 2, pague 1",
    gain: (_p, item) => `Leve 2, pague 1 em ${item}`,
    cost: itemCost,
  },
  desconto: {
    kind: "desconto",
    schema: discountParams,
    categories: "todas",
    title: (p) => `${p.pct}% de desconto`,
    gain: (p, item) => `${p.pct}% de desconto em ${item}`,
    // Desconto = receita perdida (preço × pct), não depende da margem [C].
    cost: (p, price) => ({ cents: Math.round((price * (p.pct ?? 0)) / 100), isMax: false }),
  },
};

export function validateOffer(offer: Offer, menu: readonly MenuItem[]): OfferError[] {
  const strategy = offerRegistry[offer.kind];
  const parsed = strategy.schema.safeParse(offer.params);
  if (!parsed.success) return ["parametros_invalidos"];
  const item = findItem(menu, parsed.data.itemId);
  if (!item) return ["item_inexistente"];
  const errors: OfferError[] = [];
  if (strategy.categories !== "todas" && !strategy.categories.includes(item.category)) errors.push("categoria_incompativel");
  if (offer.kind === "desconto" && (parsed.data.pct ?? 0) > MAX_DISCOUNT_PCT) errors.push("desconto_acima_do_teto");
  return errors;
}

/**
 * Regra única de uma oferta nova (S8 — revisão técnica B3): validação do tipo + item "fora das ofertas" (D197) + teto
 * do desconto. Usada por Configurações (`updateOffer`), aprovação do plano e prévia do copiloto, para o cartão nunca
 * dizer "ok" quando a aplicação recusaria.
 */
export function checkOffer(offer: Offer, activeMenu: readonly MenuItem[], noOfferItemIds: readonly string[]): OfferError[] {
  const errs = validateOffer(offer, activeMenu);
  if (noOfferItemIds.includes(offer.params.itemId)) errs.push("item_fora_das_ofertas");
  if (offer.kind === "desconto" && (offer.params.pct ?? 0) > MAX_DISCOUNT_PCT && !errs.includes("desconto_acima_do_teto")) errs.push("desconto_acima_do_teto");
  return errs;
}

/** S9: "Na 1ª visita" (a regra real) no lugar de "Pra novos clientes" (visão do dono). */
const SUBTITLES: Record<Role, string> = { agora: "Na 1ª visita", convite: "No seu convite", recompensa: "Na cartela" };

export function describeOffer(offer: Offer, menu: readonly MenuItem[], role: Role): OfferText {
  const strategy = offerRegistry[offer.kind];
  const itemName = findItem(menu, offer.params.itemId)?.name ?? "item do cardápio";
  return { title: strategy.title(offer.params), subtitle: SUBTITLES[role], itemName, gain: strategy.gain(offer.params, itemName) };
}

export function unitCost(offer: Offer, menu: readonly MenuItem[], marginPct?: number): { cents: number; isMax: boolean } {
  const item = findItem(menu, offer.params.itemId);
  if (!item) return { cents: 0, isMax: true };
  return offerRegistry[offer.kind].cost(offer.params, item.priceCents, marginPct);
}

/** Alerta (não bloqueia) quando o consumo mínimo passa de 2× o preço médio do cardápio. */
export function minSpendAlert(offer: Offer, menu: readonly MenuItem[]): boolean {
  const min = offer.params.minSpendCents;
  return min !== undefined && min > 2 * averagePriceCents(menu);
}

/** Entrada de formulário/API → oferta (o desconto sem % usa o padrão). Uma função só (revisão S2 #37). */
export function offerFromInput(o: { kind: OfferKind; itemId: string; pct?: number }, defaultPct = 10): Offer {
  return { kind: o.kind, params: { itemId: o.itemId, ...(o.kind === "desconto" ? { pct: o.pct ?? defaultPct } : {}) } };
}
