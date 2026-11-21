/**
 * Pacote proposto (espec. 3.2, 3.7; D121): o código gera, para cada horário vazio, até 3 ofertas válidas
 * de famílias diferentes, com nota só econômica; a IA escolhe entre elas casando item × turno.
 * Regras [C] (planejamento S2 §4.5 e §14): famílias por categoria; fora o item do "agora" e o da recompensa;
 * fora preço < 15% do ticket de referência; item grátis só até 50% dele; custo conhecido (com margem, ou
 * desconto) até 35% dele; nota = 1 − custo/ticket_ref. Sem margem, o custo é o preço ("custo máximo").
 */
import { averagePriceCents, type MenuCategory, type MenuItem } from "@/src/modules/beneficios/domain/menu";
import { unitCost, type Offer, type OfferKind } from "@/src/modules/beneficios/domain/offers";
import { sortByPriority, type Slot } from "@/src/modules/beneficios/domain/slots";

export const DISCOUNT_PCT_PRATO = 15;
export const INVITES_PER_TABLE = 4;
const MIN_PRICE_SHARE = 0.15;
const MAX_COST_SHARE = 0.35;
const MAX_FREE_PRICE_SHARE = 0.5;

export type Candidate = { id: string; offer: Offer; score: number; unitCostCents: number; isMax: boolean; weeklyCap: number };
export type SlotCandidates = { slotId: string; options: Candidate[] };
export type Declared = {
  ticketCents?: number | null;
  marginPct?: number | null;
  exclude: readonly string[];
  /**
   * Valor (para o cliente) do benefício da 1ª visita: o convite de volta não deve valer menos que ele
   * (revisão da S2: refrigerante de R$ 9 de convite contra cookie de R$ 16 no "agora"). Preferência, não
   * exclusão: sem item que alcance o piso, vale o mais barato da família.
   */
  minValueCents?: number;
}

type Family = { kind: OfferKind; categories: MenuCategory[]; pct?: number };
const FAMILIES: Family[] = [
  { kind: "doce_gratis", categories: ["sobremesa"] },
  { kind: "entrada_gratis", categories: ["entrada", "porcao"] },
  { kind: "cortesia", categories: ["bebida"] },
  { kind: "desconto", categories: ["prato"], pct: DISCOUNT_PCT_PRATO },
];

/** O que o cliente ganha, em centavos: o preço do item grátis ou a parte descontada. */
function clientValue(offer: Offer, item: MenuItem): number {
  return offer.kind === "desconto" ? Math.round((item.priceCents * (offer.params.pct ?? 0)) / 100) : item.priceCents;
}

export function ticketRef(menu: readonly MenuItem[], ticketCents?: number | null): number {
  return ticketCents && ticketCents > 0 ? ticketCents : 2 * averagePriceCents(menu);
}

export function weeklyCapFor(slot: Slot): number {
  return Math.max(1, slot.extraTables * INVITES_PER_TABLE);
}

export function buildCandidates(slots: readonly Slot[], menu: readonly MenuItem[], decl: Declared): SlotCandidates[] {
  const ref = ticketRef(menu, decl.ticketCents);
  const margin = decl.marginPct ?? undefined;
  const floor = decl.minValueCents ?? 0;
  const pool: Array<Omit<Candidate, "id" | "weeklyCap"> & { reaches: boolean }> = [];
  for (const f of FAMILIES) {
    let best: Omit<Candidate, "id" | "weeklyCap"> | null = null;
    let bestReaches = false;
    for (const item of menu) {
      if (!f.categories.includes(item.category) || decl.exclude.includes(item.id)) continue;
      if (item.priceCents < MIN_PRICE_SHARE * ref) continue;
      if (f.kind !== "desconto" && item.priceCents > MAX_FREE_PRICE_SHARE * ref) continue;
      const offer: Offer = { kind: f.kind, params: f.pct ? { itemId: item.id, pct: f.pct } : { itemId: item.id } };
      const cost = unitCost(offer, menu, margin);
      if (!cost.isMax && cost.cents > MAX_COST_SHARE * ref) continue;
      const cand = { offer, score: 1 - cost.cents / ref, unitCostCents: cost.cents, isMax: cost.isMax };
      const reaches = clientValue(offer, item) >= floor;
      if (!best || (reaches && !bestReaches) || (reaches === bestReaches && cost.cents < best.unitCostCents)) {
        best = cand;
        bestReaches = reaches;
      }
    }
    if (best) pool.push({ ...best, reaches: bestReaches });
  }
  // Primeiro as que alcançam o valor do "agora"; dentro de cada grupo, a nota (só econômica — D121).
  pool.sort((a, b) => Number(b.reaches) - Number(a.reaches) || b.score - a.score);
  const top = pool.slice(0, 3);
  return slots.map((s) => ({
    slotId: s.id,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- tira o campo interno
    options: top.map(({ reaches: _r, ...c }) => ({ ...c, id: `${s.id}:${c.offer.kind}:${c.offer.params.itemId}`, weeklyCap: weeklyCapFor(s) })),
  }));
}

/** Modo sem IA: por prioridade das faixas, a maior nota ainda não usada por outra faixa [C]. */
export function fallbackChoices(slots: readonly Slot[], cands: readonly SlotCandidates[]): Array<{ slotId: string; candidateId: string }> {
  const used = new Set<string>();
  const out: Array<{ slotId: string; candidateId: string }> = [];
  for (const s of sortByPriority([...slots])) {
    const opts = cands.find((c) => c.slotId === s.id)?.options ?? [];
    const pick = opts.find((o) => !used.has(`${o.offer.kind}:${o.offer.params.itemId}`)) ?? opts[0];
    if (!pick) continue;
    used.add(`${pick.offer.kind}:${pick.offer.params.itemId}`);
    out.push({ slotId: s.id, candidateId: pick.id });
  }
  return out;
}

/** Formato de `planContentSchema` (revisão T-I1): offer "plano" `{kind,itemId,pct}`. */
export function toPlanCandidate(c: Candidate): { id: string; offer: { kind: OfferKind; itemId: string; pct?: number }; score: number; unitCostCents: number; weeklyCap: number } {
  return {
    id: c.id,
    offer: { kind: c.offer.kind, itemId: c.offer.params.itemId, ...(c.offer.params.pct !== undefined ? { pct: c.offer.params.pct } : {}) },
    score: c.score,
    unitCostCents: c.unitCostCents,
    weeklyCap: c.weeklyCap,
  };
}

const cheapest = (menu: readonly MenuItem[], cats: MenuCategory[]) =>
  [...menu].filter((i) => cats.includes(i.category)).sort((a, b) => a.priceCents - b.priceCents || a.name.localeCompare(b.name))[0];

/** "Agora" de menor custo por cliente identificado [C]: doce grátis > cortesia > entrada grátis. */
export function proposeAgora(menu: readonly MenuItem[]): Offer | null {
  const doce = cheapest(menu, ["sobremesa"]);
  if (doce) return { kind: "doce_gratis", params: { itemId: doce.id } };
  const bebida = cheapest(menu, ["bebida"]);
  if (bebida) return { kind: "cortesia", params: { itemId: bebida.id } };
  const entrada = cheapest(menu, ["entrada", "porcao"]);
  if (entrada) return { kind: "entrada_gratis", params: { itemId: entrada.id } };
  const any = cheapest(menu, ["prato"]);
  return any ? { kind: "leve2pague1", params: { itemId: any.id } } : null;
}

/** Recompensa da cartela [C]: a sobremesa de maior preço; sem sobremesa, o prato de menor preço (leve 2, pague 1). */
export function proposeRecompensa(menu: readonly MenuItem[]): Offer | null {
  const doce = [...menu].filter((i) => i.category === "sobremesa").sort((a, b) => b.priceCents - a.priceCents)[0];
  if (doce) return { kind: "doce_gratis", params: { itemId: doce.id } };
  const prato = cheapest(menu, ["prato"]);
  if (prato) return { kind: "leve2pague1", params: { itemId: prato.id } };
  const outro = cheapest(menu, ["porcao", "entrada", "bebida"]);
  return outro ? { kind: "leve2pague1", params: { itemId: outro.id } } : null;
}

/**
 * Teto recalibrado no plano da semana (espec. 3.3): `ceil(mesas / clamp(uso, 0,1, 1))`, com o uso das coortes
 * de ≥ 7 dias; sem coorte, a regra inicial (mesas × 4). Uma fórmula só, junto de `weeklyCapFor`.
 */
export function recalibratedCap(extraTables: number, usage: number | null): number {
  if (usage === null || !Number.isFinite(usage)) return Math.max(1, extraTables * INVITES_PER_TABLE);
  const u = Math.min(1, Math.max(0.1, usage));
  return Math.max(1, Math.ceil(extraTables / u));
}
