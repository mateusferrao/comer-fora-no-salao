/**
 * Limpeza "de carona" (espec. 4.6; D118/D119): contas sem acesso há 7 dias são apagadas em cascata
 * (restaurantes, cópias, check-ins…), no máximo 2 por vez e fora do caminho da resposta. Contas do seed
 * (`via` nulo) e donos de restaurantes `protected` nunca entram.
 */
import { and, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { loginCodes, owners } from "@/src/db/schema";

export const INACTIVE_DAYS = 7;

export async function cleanupStaleAccounts(db: Db, now: Date, limit = 2): Promise<number> {
  const cutoff = new Date(now.getTime() - INACTIVE_DAYS * 86_400_000);
  // Códigos de login vencem em 10 min; depois de 1 dia não servem nem para o limite — e guardam o HMAC do
  // e-mail, que deve sumir com a conta (revisão da S2).
  await db.delete(loginCodes).where(lt(loginCodes.createdAt, new Date(now.getTime() - 86_400_000)));
  const stale = await db
    .select({ id: owners.id })
    .from(owners)
    .where(
      and(
        inArray(owners.via, ["email", "link", "e2e"]),
        lt(owners.lastSeenAt, cutoff),
        sql`not exists (select 1 from restaurants r where r.owner_id = ${owners.id} and r.protected)`,
      ),
    )
    .limit(limit);
  if (!stale.length) return 0;
  await db.delete(owners).where(inArray(owners.id, stale.map((s) => s.id)));
  return stale.length;
}
