/** Leitura do contexto de regras de um restaurante (cardápio, faixas, versões vigentes, teto). */
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { benefits, benefitVersions, idleSlots, invites, menuItems, restaurants } from "@/src/db/schema";
import type { MenuCategory, MenuItem } from "@/src/modules/beneficios/domain/menu";
import { offerRegistry, OFFER_KINDS, type Offer, type OfferKind } from "@/src/modules/beneficios/domain/offers";
import { openingHoursSchema, type Intensity, type OpeningHours, type Slot } from "@/src/modules/beneficios/domain/slots";

export type RestaurantRow = typeof restaurants.$inferSelect;
export type VersionedOffer = { versionId: string; offer: Offer; weeklyCap: number | null; /** Texto do convite aprovado (D122), com referências; congelado na versão. */ inviteText: string | null };

export type RestaurantContext = {
  restaurant: RestaurantRow;
  opening: OpeningHours;
  menu: MenuItem[];
  /** Itens desativados no cardápio: ainda descrevem versões antigas, mas não entram em escolhas novas (revisão da S2). */
  inactiveItemIds: string[];
  /** Faixas ativas, na ordem de criação. */
  slots: Slot[];
  agora: VersionedOffer | null;
  recompensa: VersionedOffer | null;
  /** Regra do convite vigente por faixa. */
  convites: Record<string, VersionedOffer>;
};

/** Versão com os parâmetros validados pelo contrato do tipo (estratégia); inválida → null. */
export function toVersionedOffer(v: typeof benefitVersions.$inferSelect): VersionedOffer | null {
  if (!(OFFER_KINDS as readonly string[]).includes(v.kind)) return null;
  const kind = v.kind as OfferKind;
  const parsed = offerRegistry[kind].schema.safeParse(v.params);
  if (!parsed.success) return null;
  return { versionId: v.id, offer: { kind, params: parsed.data }, weeklyCap: v.weeklyCap, inviteText: v.inviteText ?? null };
}

/** Versão de um benefício pelo id — o convite usa a versão da EMISSÃO (oferta congelada — espec. 3.3, D218). */
export async function loadVersion(ex: Executor, versionId: string | null): Promise<VersionedOffer | null> {
  if (!versionId) return null;
  const [v] = await ex.select().from(benefitVersions).where(eq(benefitVersions.id, versionId)).limit(1);
  return v ? toVersionedOffer(v) : null;
}

export async function findRestaurantBySlug(ex: Executor, slug: string): Promise<RestaurantRow | null> {
  const [r] = await ex.select().from(restaurants).where(eq(restaurants.slug, slug)).limit(1);
  return r ?? null;
}

export async function loadContext(ex: Executor, restaurantId: string): Promise<RestaurantContext | null> {
  const [restaurant] = await ex.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1);
  if (!restaurant) return null;
  const items = await ex
    .select()
    .from(menuItems)
    // Itens inativos também: versões e convites antigos ainda os descrevem (revisão T-I12).
    .where(eq(menuItems.restaurantId, restaurantId))
    .orderBy(asc(menuItems.position));
  const slotRows = await ex
    .select()
    .from(idleSlots)
    .where(and(eq(idleSlots.restaurantId, restaurantId), eq(idleSlots.active, true)))
    .orderBy(asc(idleSlots.position), asc(idleSlots.createdAt));
  const versions = await ex
    .select({ v: benefitVersions, role: benefits.role, slotId: benefits.slotId })
    .from(benefitVersions)
    .innerJoin(benefits, eq(benefits.id, benefitVersions.benefitId))
    .where(and(eq(benefitVersions.restaurantId, restaurantId), isNull(benefitVersions.supersededAt)));

  const convites: Record<string, VersionedOffer> = {};
  let agora: VersionedOffer | null = null;
  let recompensa: VersionedOffer | null = null;
  for (const row of versions) {
    const offer = toVersionedOffer(row.v);
    if (!offer) continue; // versão com parâmetros inválidos não entra em vigor
    const toOffer = () => offer;
    if (row.role === "agora") agora = toOffer();
    else if (row.role === "recompensa") recompensa = toOffer();
    else if (row.role === "convite" && row.slotId) convites[row.slotId] = toOffer();
  }
  const parsedOpening = openingHoursSchema.safeParse(restaurant.openingHours);
  return {
    restaurant,
    opening: parsedOpening.success ? parsedOpening.data : [],
    menu: items.map((i) => ({ id: i.id, category: i.category as MenuCategory, name: i.name, priceCents: i.priceCents })),
    inactiveItemIds: items.filter((i) => !i.active).map((i) => i.id),
    slots: slotRows.map((s) => ({
      id: s.id,
      days: s.days,
      startMin: s.startMin,
      endMin: s.endMin,
      intensity: s.intensity as Intensity,
      extraTables: s.extraTables,
    })),
    agora,
    recompensa,
    convites,
  };
}

/** Faixas com regra de convite vigente (as únicas que entram no sorteio). */
export function inviteSlots(ctx: RestaurantContext): Slot[] {
  return ctx.slots.filter((s) => ctx.convites[s.id]?.weeklyCap != null);
}

/** Convites reais emitidos por faixa na semana (fonte da verdade do teto — T-I4). */
export async function countRealInvites(ex: Executor, restaurantId: string, slotIds: string[], weekKey: string): Promise<Record<string, number>> {
  if (slotIds.length === 0) return {};
  const rows = await ex
    .select({ slotId: invites.slotId, n: count() })
    .from(invites)
    .where(and(eq(invites.restaurantId, restaurantId), inArray(invites.slotId, slotIds), eq(invites.weekKey, weekKey), eq(invites.arm, "convidavel")))
    .groupBy(invites.slotId);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.slotId] = Number(r.n);
  return out;
}

export async function remainingBySlot(ex: Executor, ctx: RestaurantContext, weekKey: string): Promise<Record<string, number>> {
  const slots = inviteSlots(ctx);
  const used = await countRealInvites(ex, ctx.restaurant.id, slots.map((s) => s.id), weekKey);
  const out: Record<string, number> = {};
  for (const s of slots) out[s.id] = Math.max(0, (ctx.convites[s.id]!.weeklyCap ?? 0) - (used[s.id] ?? 0));
  return out;
}
