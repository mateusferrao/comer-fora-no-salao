/**
 * Ferramentas do avaliador (D153, S4 §4.6) — ficam nos Bastidores, fora das telas do produto.
 * - "Avançar 1 dia": recua os convites emitidos hoje (clientes reais) de um restaurante do próprio dono.
 * - "Ver como cliente reativado": um cliente do histórico da cópia do dono que recebeu reativação.
 */
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { customers, invites, restaurants } from "@/src/db/schema";
import { daySP } from "@/src/shared/tz";
import { advanceInvite } from "./advance-invite";

export type AdvanceRestaurantResult = { ok: true; advanced: number; liberatedToday: number } | { ok: false; erro: "nao_e_seu" | "nada_para_avancar" };

export async function advanceRestaurantOneDay(db: Db, p: { ownerId: string; restaurantId: string; now: Date; allowE2eRestaurant?: boolean }): Promise<AdvanceRestaurantResult> {
  const [r] = await db.select({ ownerId: restaurants.ownerId }).from(restaurants).where(eq(restaurants.id, p.restaurantId));
  if (!r || (r.ownerId !== p.ownerId && !p.allowE2eRestaurant)) return { ok: false, erro: "nao_e_seu" };
  const today = daySP(p.now);
  const rows = await db
    .select({ id: invites.id, customerId: invites.customerId })
    .from(invites)
    .innerJoin(customers, eq(customers.id, invites.customerId))
    .where(and(eq(invites.restaurantId, p.restaurantId), eq(invites.status, "ativo"), eq(invites.arm, "convidavel"), eq(invites.issuedDay, today), isNull(customers.simulationRunId)));
  let advanced = 0;
  let liberated = 0;
  // Um convite por transação, na mesma ordem de locks do check-in (revisão técnica I5).
  for (const row of rows) {
    const res = await advanceInvite(db, { customerId: row.customerId, inviteId: row.id, now: p.now });
    if (res.ok) {
      advanced++;
      if (res.testValidToday) liberated++;
    }
  }
  return advanced ? { ok: true, advanced, liberatedToday: liberated } : { ok: false, erro: "nada_para_avancar" };
}

/** Cliente do histórico (cópia do dono) que tem convite ativo de reativação — para ver a Jornada dele. */
export async function pickReactivatedCustomer(db: Db, p: { ownerId: string; now: Date }): Promise<string | null> {
  const mine = await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.ownerId, p.ownerId));
  if (!mine.length) return null;
  const [row] = await db
    .select({ customerId: invites.customerId })
    .from(invites)
    .where(and(inArray(invites.restaurantId, mine.map((m) => m.id)), eq(invites.origin, "reativacao"), eq(invites.arm, "convidavel"), eq(invites.status, "ativo")))
    .orderBy(desc(invites.issuedAt))
    .limit(1);
  return row?.customerId ?? null;
}
