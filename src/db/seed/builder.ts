/** Cria um restaurante completo com cardápio, faixas e regras (seed da vitrine, restaurante E2E e testes). */
import { eq } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { benefits, benefitVersions, idleSlots, kitPieces, menuItems, menus, owners, pieceVariants, restaurants } from "@/src/db/schema";
import type { MenuCategory } from "@/src/modules/beneficios/domain/menu";
import type { OfferKind } from "@/src/modules/beneficios/domain/offers";
import type { Intensity, OpeningHours } from "@/src/modules/beneficios/domain/slots";

export type OfferSpec = { kind: OfferKind; item: string; pct?: number };

export type RestaurantSpec = {
  owner: { id?: string; kind: "demo" | "teste" };
  id?: string;
  slug: string;
  kind: "vitrine" | "teste";
  name: string;
  cuisine?: string;
  priceBand?: string;
  opening: OpeningHours;
  tables?: number;
  weeklyCustomers?: number;
  lat?: number;
  lng?: number;
  ticketCents?: number;
  marginPct?: number;
  description?: string;
  address?: string;
  heroImage?: string;
  recado?: string;
  protected?: boolean;
  activatedAt: Date;
  menu: Array<{ key: string; category: MenuCategory; name: string; priceCents: number }>;
  agora: OfferSpec;
  recompensa: OfferSpec;
  /** `inviteText`: texto aprovado do convite (D122); "{horario}" vira a referência da própria faixa. */
  slots: Array<{ key: string; days: number[]; startMin: number; endMin: number; intensity: Intensity; extraTables: number; convite: OfferSpec; weeklyCap: number; inviteText?: string }>;
  copiedFrom?: string;
  setupStatus?: string;
  pieces?: Array<{ kind: "display" | "cartaz" | "garcom"; variants: Array<{ label: string; token: string; texts: Record<string, string> }> }>;
};

export type BuiltRestaurant = {
  restaurantId: string;
  ownerId: string;
  items: Record<string, string>;
  slots: Record<string, string>;
  versions: { agora: string; recompensa: string; convites: Record<string, string> };
  variants: Record<string, string>;
};

export async function buildRestaurant(ex: Executor, spec: RestaurantSpec): Promise<BuiltRestaurant> {
  let ownerId = spec.owner.id;
  if (ownerId) {
    const [o] = await ex.select({ id: owners.id }).from(owners).where(eq(owners.id, ownerId)).limit(1);
    if (!o) await ex.insert(owners).values({ id: ownerId, kind: spec.owner.kind });
  } else {
    const [o] = await ex.insert(owners).values({ kind: spec.owner.kind }).returning({ id: owners.id });
    ownerId = o!.id;
  }
  const [r] = await ex
    .insert(restaurants)
    .values({
      ...(spec.id ? { id: spec.id } : {}),
      ownerId,
      slug: spec.slug,
      kind: spec.kind,
      name: spec.name,
      cuisine: spec.cuisine,
      priceBand: spec.priceBand,
      openingHours: spec.opening,
      tables: spec.tables,
      weeklyCustomers: spec.weeklyCustomers,
      lat: spec.lat,
      lng: spec.lng,
      ticketCents: spec.ticketCents,
      marginPct: spec.marginPct,
      description: spec.description,
      address: spec.address,
      heroImage: spec.heroImage,
      recado: spec.recado,
      protected: spec.protected ?? false,
      copiedFrom: spec.copiedFrom ?? null,
      setupStatus: spec.setupStatus ?? null,
      setupStartedAt: spec.setupStatus ? new Date() : null,
      status: "ativo",
      activatedAt: spec.activatedAt,
    })
    .returning({ id: restaurants.id });
  const restaurantId = r!.id;

  const [menu] = await ex.insert(menus).values({ restaurantId, source: "seed" }).returning({ id: menus.id });
  const itemRows = await ex
    .insert(menuItems)
    .values(spec.menu.map((m, i) => ({ menuId: menu!.id, restaurantId, category: m.category, name: m.name, priceCents: m.priceCents, position: i })))
    .returning({ id: menuItems.id });
  const items: Record<string, string> = {};
  spec.menu.forEach((m, i) => (items[m.key] = itemRows[i]!.id));
  const params = (o: OfferSpec) => ({ itemId: items[o.item]!, ...(o.pct !== undefined ? { pct: o.pct } : {}) });

  const version = async (role: "agora" | "convite" | "recompensa", offer: OfferSpec, slotId: string | null, weeklyCap: number | null, inviteText: string | null = null) => {
    const [b] = await ex.insert(benefits).values({ restaurantId, role, slotId }).returning({ id: benefits.id });
    const [v] = await ex
      .insert(benefitVersions)
      .values({ benefitId: b!.id, restaurantId, version: 1, kind: offer.kind, params: params(offer), weeklyCap, validFrom: spec.activatedAt, inviteText })
      .returning({ id: benefitVersions.id });
    return v!.id;
  };

  const agora = await version("agora", spec.agora, null, null);
  const recompensa = await version("recompensa", spec.recompensa, null, null);
  const slots: Record<string, string> = {};
  const convites: Record<string, string> = {};
  for (const [i, s] of spec.slots.entries()) {
    const [row] = await ex
      .insert(idleSlots)
      .values({ restaurantId, days: s.days, startMin: s.startMin, endMin: s.endMin, intensity: s.intensity, extraTables: s.extraTables, position: i })
      .returning({ id: idleSlots.id });
    slots[s.key] = row!.id;
    convites[s.key] = await version("convite", s.convite, row!.id, s.weeklyCap, s.inviteText ? s.inviteText.replace("{horario}", `{horario:${row!.id}}`) : null);
  }

  const variants: Record<string, string> = {};
  for (const piece of spec.pieces ?? []) {
    const [p] = await ex.insert(kitPieces).values({ restaurantId, kind: piece.kind, status: "no_salao", inSalonAt: spec.activatedAt }).returning({ id: kitPieces.id });
    for (const v of piece.variants) {
      const [pv] = await ex
        .insert(pieceVariants)
        .values({ pieceId: p!.id, restaurantId, label: v.label, qrToken: v.token, texts: v.texts })
        .returning({ id: pieceVariants.id });
      variants[v.token] = pv!.id;
    }
  }
  return { restaurantId, ownerId: ownerId!, items, slots, versions: { agora, recompensa, convites }, variants };
}
