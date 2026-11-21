/**
 * Token do agente (MCP; flag `mcp` — D219): 32 bytes aleatórios, mostrado UMA vez ao dono; guardado só como
 * SHA-256, revogável, ligado a 1 restaurante. Um token ativo por restaurante (gerar de novo revoga o anterior).
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Executor } from "@/src/db/executor";
import { mcpTokens } from "@/src/db/schema";
import { hashToken, newToken, sameHash } from "@/src/shared/tokens";

export { hashToken };

const PREFIX = "cfs_";

export async function createToken(db: Db, restaurantId: string, now: Date): Promise<{ token: string; hint: string }> {
  const token = newToken(PREFIX);
  const hint = token.slice(-4);
  await db.transaction(async (tx) => {
    await tx.update(mcpTokens).set({ revokedAt: now }).where(and(eq(mcpTokens.restaurantId, restaurantId), isNull(mcpTokens.revokedAt)));
    await tx.insert(mcpTokens).values({ restaurantId, tokenHash: hashToken(token), hint, createdAt: now });
  });
  return { token, hint };
}

export async function listTokens(ex: Executor, restaurantId: string): Promise<Array<{ id: string; hint: string; createdAt: string; active: boolean }>> {
  const rows = await ex.select().from(mcpTokens).where(eq(mcpTokens.restaurantId, restaurantId)).orderBy(desc(mcpTokens.createdAt)).limit(5);
  return rows.map((r) => ({ id: r.id, hint: r.hint, createdAt: r.createdAt.toISOString(), active: !r.revokedAt }));
}

export async function revokeTokens(db: Db, restaurantId: string, now: Date): Promise<void> {
  await db.update(mcpTokens).set({ revokedAt: now }).where(and(eq(mcpTokens.restaurantId, restaurantId), isNull(mcpTokens.revokedAt)));
}

/** Resolve o token (formato, hash, comparação em tempo constante); revogado ou desconhecido → null. */
export async function resolveToken(ex: Executor, token: string | null): Promise<{ tokenId: string; restaurantId: string } | null> {
  if (!token || !token.startsWith(PREFIX) || token.length < 40 || token.length > 80) return null;
  const h = hashToken(token);
  const [row] = await ex.select().from(mcpTokens).where(and(eq(mcpTokens.tokenHash, h), isNull(mcpTokens.revokedAt))).limit(1);
  if (!row) return null;
  if (!sameHash(row.tokenHash, h)) return null;
  return { tokenId: row.id, restaurantId: row.restaurantId };
}
