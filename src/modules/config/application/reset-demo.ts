/**
 * Resetar demo (Bastidores, com senha — espec. 5 "checklist"; planejamento S3 §4.7).
 * - "Recriar minha demo": apaga os restaurantes da conta logada (testes e cópia) e refaz a cópia da vitrine.
 * - "Recriar vitrine pública": apaga a vitrine original (com as visitas reais de "Sou cliente") e o seed a recria.
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { restaurants } from "@/src/db/schema";
import { seedAll } from "@/src/db/seed";
import { vitrineHistory } from "@/src/db/seed/history";
import { VITRINE_ID } from "@/src/db/seed/vitrine";
import { copyVitrineFor } from "@/src/modules/contas/application/copy-vitrine";
import { fixedClock } from "@/src/shared/clock";

export async function recreateMyDemo(db: Db, p: { ownerId: string; now: Date; seedDb?: Db }): Promise<{ ok: boolean; removed: number }> {
  const del = await db.delete(restaurants).where(and(eq(restaurants.ownerId, p.ownerId), eq(restaurants.protected, false))).returning({ id: restaurants.id });
  const r = await copyVitrineFor(p.ownerId, p.now, p.seedDb);
  return { ok: r !== "falhou", removed: del.length };
}

export async function recreatePublicVitrine(db: Db, p: { now: Date }): Promise<{ ok: boolean }> {
  await db.delete(restaurants).where(eq(restaurants.id, VITRINE_ID));
  const r = await seedAll(db, fixedClock(p.now.toISOString()), vitrineHistory);
  return { ok: r.vitrine === "criada" };
}
