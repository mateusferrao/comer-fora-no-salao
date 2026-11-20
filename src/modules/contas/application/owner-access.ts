/**
 * Acesso do dono aos próprios restaurantes (espec. 4.6: restaurante sempre da sessão, autorização na
 * camada de dados). Toda rota do Portal passa por `forRestaurant`.
 */
import { and, asc, eq, lt, or, isNull } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { owners, restaurants } from "@/src/db/schema";

export type OwnerRow = typeof owners.$inferSelect;
export type OwnedRestaurant = typeof restaurants.$inferSelect;

export class NotOwnedError extends Error {
  constructor() {
    super("restaurante não encontrado");
    this.name = "NotOwnedError";
  }
}

export async function findOwner(ex: Executor, ownerId: string): Promise<OwnerRow | null> {
  const [o] = await ex.select().from(owners).where(eq(owners.id, ownerId));
  return o ?? null;
}

/** Atualiza `last_seen_at` no máximo 1×/h (revisão T-I6: a limpeza de 7 dias não pode apagar sessão ativa). */
export async function touchOwner(ex: Executor, ownerId: string, now: Date): Promise<void> {
  const hourAgo = new Date(now.getTime() - 3_600_000);
  await ex
    .update(owners)
    .set({ lastSeenAt: now })
    .where(and(eq(owners.id, ownerId), or(isNull(owners.lastSeenAt), lt(owners.lastSeenAt, hourAgo))));
}

export async function listOwnerRestaurants(ex: Executor, ownerId: string): Promise<OwnedRestaurant[]> {
  return ex.select().from(restaurants).where(eq(restaurants.ownerId, ownerId)).orderBy(asc(restaurants.createdAt));
}

export async function forRestaurant(ex: Executor, ownerId: string, restaurantId: string): Promise<OwnedRestaurant> {
  if (!/^[0-9a-f-]{36}$/.test(restaurantId)) throw new NotOwnedError();
  const [r] = await ex
    .select()
    .from(restaurants)
    .where(and(eq(restaurants.id, restaurantId), eq(restaurants.ownerId, ownerId)));
  if (!r) throw new NotOwnedError();
  return r;
}
