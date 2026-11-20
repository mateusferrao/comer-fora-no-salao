/**
 * Restaurantes de teste da conta (D20, D130): até 3 por conta; 10 por IP por dia. O endereço é fictício
 * e padrão (revisão P-M9), para a aba Sobre não ficar vazia.
 */
import { and, count, eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { owners, restaurants } from "@/src/db/schema";
import { consume } from "@/src/shared/rate-limit";
import { secureRandInt } from "@/src/shared/crypto";

export const MAX_TEST_RESTAURANTS = 3;
export const DEFAULT_ADDRESS = "Rua Exemplo Fictícia, 100 – São Paulo – SP";
const ALPHA = "abcdefghijkmnpqrstuvwxyz23456789";

export function randomSuffix(n = 6, randInt: (n: number) => number = secureRandInt): string {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHA[randInt(ALPHA.length)];
  return s;
}

export type CreateTestResult = { ok: true; restaurantId: string } | { ok: false; erro: "limite_conta" | "limite"; retryAfterSec?: number };

export async function createTestRestaurant(db: Db, p: { ownerId: string; ip: string; now: Date }): Promise<CreateTestResult> {
  const [owner] = await db.select({ via: owners.via }).from(owners).where(eq(owners.id, p.ownerId));
  const isE2e = owner?.via === "e2e";
  const [c] = await db
    .select({ n: count() })
    .from(restaurants)
    .where(and(eq(restaurants.ownerId, p.ownerId), eq(restaurants.kind, "teste")));
  if ((c?.n ?? 0) >= MAX_TEST_RESTAURANTS) return { ok: false, erro: "limite_conta" };
  if (!isE2e) {
    const lim = await consume(db, `restaurante:ip:${p.ip}`, 10, 86_400, p.now);
    if (!lim.ok) return { ok: false, erro: "limite", retryAfterSec: lim.retryAfterSec };
  }
  const [r] = await db
    .insert(restaurants)
    .values({
      ownerId: p.ownerId,
      slug: `teste-${randomSuffix(8)}`,
      kind: "teste",
      name: "Meu restaurante",
      status: "rascunho",
      address: DEFAULT_ADDRESS,
      onboardingStep: 1,
      createdAt: p.now,
    })
    .returning({ id: restaurants.id });
  return { ok: true, restaurantId: r!.id };
}

/** Exclui um restaurante de teste do próprio dono (a cópia da vitrine não se exclui por aqui). */
export async function deleteTestRestaurant(db: Db, p: { ownerId: string; restaurantId: string }): Promise<boolean> {
  const del = await db
    .delete(restaurants)
    .where(and(eq(restaurants.id, p.restaurantId), eq(restaurants.ownerId, p.ownerId), eq(restaurants.kind, "teste"), eq(restaurants.protected, false)))
    .returning({ id: restaurants.id });
  return del.length > 0;
}
