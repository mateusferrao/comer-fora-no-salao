/**
 * Link do garçom (S6.2 — D190): abre só "Validar código" do restaurante, sem login. Token de 32 bytes mostrado UMA
 * vez (link + QR), guardado só como SHA-256; 1 ativo por restaurante (índice parcial + transação); "Revogar" corta
 * na hora, porque a sessão do garçom (cookie com o id do token) é conferida no banco a cada chamada.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Executor } from "@/src/db/executor";
import { restaurants, waiterTokens } from "@/src/db/schema";
import { hashToken, newToken, plausibleToken, sameHash } from "@/src/shared/tokens";

export const WAITER_PREFIX = "gc_";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function createWaiterToken(db: Db, p: { restaurantId: string; now: Date }): Promise<{ token: string; createdAt: Date }> {
  const token = newToken(WAITER_PREFIX);
  await db.transaction(async (tx) => {
    await tx.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.id, p.restaurantId)).for("update");
    await tx.update(waiterTokens).set({ revokedAt: p.now }).where(and(eq(waiterTokens.restaurantId, p.restaurantId), isNull(waiterTokens.revokedAt)));
    await tx.insert(waiterTokens).values({ restaurantId: p.restaurantId, tokenHash: hashToken(token), createdAt: p.now });
  });
  return { token, createdAt: p.now };
}

export async function revokeWaiterTokens(db: Db, restaurantId: string, now: Date): Promise<void> {
  await db.update(waiterTokens).set({ revokedAt: now }).where(and(eq(waiterTokens.restaurantId, restaurantId), isNull(waiterTokens.revokedAt)));
}

export async function activeWaiterToken(ex: Executor, restaurantId: string): Promise<{ createdAt: Date } | null> {
  const [r] = await ex
    .select({ createdAt: waiterTokens.createdAt })
    .from(waiterTokens)
    .where(and(eq(waiterTokens.restaurantId, restaurantId), isNull(waiterTokens.revokedAt)))
    .orderBy(desc(waiterTokens.createdAt))
    .limit(1);
  return r ?? null;
}

/** Token do link → id + restaurante (revogado ou desconhecido → null). */
export async function resolveWaiterToken(ex: Executor, token: string | null | undefined): Promise<{ id: string; restaurantId: string } | null> {
  if (!plausibleToken(token, WAITER_PREFIX)) return null;
  const h = hashToken(token);
  const [row] = await ex.select().from(waiterTokens).where(and(eq(waiterTokens.tokenHash, h), isNull(waiterTokens.revokedAt))).limit(1);
  if (!row || !sameHash(row.tokenHash, h)) return null;
  return { id: row.id, restaurantId: row.restaurantId };
}

/** Sessão do garçom (id do token, do cookie assinado) → restaurante ativo; revogado → null. */
export async function resolveWaiterSession(ex: Executor, tokenId: string | null | undefined): Promise<{ tokenId: string; restaurantId: string; restaurantName: string; ownerId: string } | null> {
  if (!tokenId || !UUID_RE.test(tokenId)) return null;
  const [r] = await ex
    .select({ restaurantId: waiterTokens.restaurantId, name: restaurants.name, status: restaurants.status, ownerId: restaurants.ownerId })
    .from(waiterTokens)
    .innerJoin(restaurants, eq(restaurants.id, waiterTokens.restaurantId))
    .where(and(eq(waiterTokens.id, tokenId), isNull(waiterTokens.revokedAt)))
    .limit(1);
  if (!r || r.status !== "ativo") return null;
  return { tokenId, restaurantId: r.restaurantId, restaurantName: r.name, ownerId: r.ownerId };
}
