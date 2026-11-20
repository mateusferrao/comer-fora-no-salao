/** Consultas das telas do cliente. Nada de oferta ou horário do convite antes do check-in (holdout — P-I7). */
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { checkins, customerContacts, restaurantCustomers, restaurants } from "@/src/db/schema";
import { openingStatus } from "@/src/modules/beneficios/domain/slots";
import { STAMP_CARD_DEFAULTS, isCardExpired } from "@/src/modules/beneficios/domain/stamp-card";
import { daySP } from "@/src/shared/tz";
import { findRestaurantBySlug, loadContext } from "./context";
import { todayView } from "./do-checkin";
import { offerView, sanitizeCheckinView, type CheckinView, type CodeView, type InviteView, type OfferView } from "./views";

export type RestaurantPageView = {
  id: string;
  slug: string;
  name: string;
  cuisine: string | null;
  priceBand: string | null;
  openingLabel: string;
  lat: number | null;
  lng: number | null;
  heroImage: string | null;
  description: string | null;
  address: string | null;
  recado: string | null;
  agora: OfferView | null;
  recompensa: OfferView | null;
};

export async function getRestaurantPage(ex: Executor, slug: string, now: Date): Promise<RestaurantPageView | null> {
  const r = await findRestaurantBySlug(ex, slug);
  if (!r || r.status !== "ativo") return null;
  const ctx = await loadContext(ex, r.id);
  if (!ctx) return null;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    cuisine: r.cuisine,
    priceBand: r.priceBand,
    openingLabel: openingStatus(ctx.opening, now).label,
    lat: r.lat,
    lng: r.lng,
    heroImage: r.heroImage,
    description: r.description,
    address: r.address,
    recado: r.recado,
    agora: offerView(ctx.agora?.offer, ctx.menu, "agora"),
    recompensa: offerView(ctx.recompensa?.offer, ctx.menu, "recompensa"),
  };
}

export type CustomerHere = { firstName: string; stamps: number; required: number };

/** Selos correntes do cliente neste restaurante (cartela vencida conta como 0). */
export async function getCustomerHere(ex: Executor, restaurantId: string, customerId: string, now: Date): Promise<CustomerHere | null> {
  const [contact] = await ex.select({ name: customerContacts.name }).from(customerContacts).where(eq(customerContacts.customerId, customerId)).limit(1);
  if (!contact) return null;
  const [rc] = await ex
    .select()
    .from(restaurantCustomers)
    .where(and(eq(restaurantCustomers.restaurantId, restaurantId), eq(restaurantCustomers.customerId, customerId)))
    .limit(1);
  let stamps = 0;
  if (rc?.cardStartedDay) {
    const card = { startedDay: rc.cardStartedDay, stamps: rc.cardStamps, lastDay: rc.cardLastDay, completedDay: rc.cardCompletedDay };
    const today = daySP(now);
    const finished = card.completedDay !== null && card.completedDay !== today;
    stamps = finished || isCardExpired(card, today, STAMP_CARD_DEFAULTS) ? 0 : card.stamps;
  }
  return { firstName: contact.name.split(" ")[0] ?? contact.name, stamps, required: STAMP_CARD_DEFAULTS.required };
}

export type JourneyView = {
  firstName: string | null;
  visits: number;
  restaurants: Array<{ slug: string; name: string; visits: number; stamps: number; required: number; invite: InviteView | null; todayCodes: CodeView[] }>;
};

export async function getJourney(ex: Executor, customerId: string | null, now: Date): Promise<JourneyView> {
  if (!customerId) return { firstName: null, visits: 0, restaurants: [] };
  const [contact] = await ex.select({ name: customerContacts.name }).from(customerContacts).where(eq(customerContacts.customerId, customerId)).limit(1);
  if (!contact) return { firstName: null, visits: 0, restaurants: [] };
  const rows = await ex
    .select({ restaurantId: checkins.restaurantId, slug: restaurants.slug, name: restaurants.name, visits: count(), last: sql<Date>`max(${checkins.at})` })
    .from(checkins)
    .innerJoin(restaurants, eq(restaurants.id, checkins.restaurantId))
    .where(eq(checkins.customerId, customerId))
    .groupBy(checkins.restaurantId, restaurants.slug, restaurants.name)
    .orderBy(desc(sql`max(${checkins.at})`));
  const list: JourneyView["restaurants"] = [];
  for (const row of rows) {
    const ctx = await loadContext(ex, row.restaurantId);
    if (!ctx) continue;
    const here = await getCustomerHere(ex, row.restaurantId, customerId, now);
    const t = await todayView(ex, ctx, customerId, now);
    list.push({ slug: row.slug, name: row.name, visits: Number(row.visits), stamps: here?.stamps ?? 0, required: STAMP_CARD_DEFAULTS.required, invite: t.invite, todayCodes: t.codes });
  }
  return { firstName: contact.name.split(" ")[0] ?? contact.name, visits: list.reduce((s, r) => s + r.visits, 0), restaurants: list };
}

/** Se o cliente já fez check-in hoje aqui, o resultado do dia (códigos não validados + convite) — recarregar não exige GPS. */
export async function getTodayResult(ex: Executor, restaurantId: string, customerId: string, now: Date): Promise<CheckinView | null> {
  const [rc] = await ex
    .select({ last: restaurantCustomers.lastCheckinDay })
    .from(restaurantCustomers)
    .where(and(eq(restaurantCustomers.restaurantId, restaurantId), eq(restaurantCustomers.customerId, customerId)))
    .limit(1);
  if (rc?.last !== daySP(now)) return null;
  const ctx = await loadContext(ex, restaurantId);
  const here = await getCustomerHere(ex, restaurantId, customerId, now);
  if (!ctx || !here) return null;
  const t = await todayView(ex, ctx, customerId, now);
  return sanitizeCheckinView({ outcome: "ja_fez_checkin_hoje", stamps: here.stamps, required: here.required, ...t, firstVisitAlreadyUsed: false });
}
