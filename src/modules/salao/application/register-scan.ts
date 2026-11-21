/** Leitura do QR registrada por beacon (D49): dedupe de 30 min por aparelho + versão; robôs ignorados. */
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { pieceVariants, scans } from "@/src/db/schema";
import type { Clock } from "@/src/shared/clock";
import { daySP } from "@/src/shared/tz";
import { isBot, shouldCountScan } from "@/src/modules/salao/domain/scan-dedupe";

export async function findVariantByToken(ex: Executor, restaurantId: string, token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const [v] = await ex
    .select({ id: pieceVariants.id })
    .from(pieceVariants)
    .where(and(eq(pieceVariants.qrToken, token), eq(pieceVariants.restaurantId, restaurantId)))
    .limit(1);
  return v?.id ?? null;
}

export async function registerScan(
  ex: Executor,
  p: { restaurantId: string; variantId: string | null; deviceHash: string; userAgent: string | null; clock: Clock },
): Promise<{ counted: boolean; reason?: "robo" | "repetida" }> {
  if (isBot(p.userAgent)) return { counted: false, reason: "robo" };
  const now = p.clock.now();
  const [last] = await ex
    .select({ at: scans.at })
    .from(scans)
    .where(
      and(
        eq(scans.restaurantId, p.restaurantId),
        eq(scans.deviceHash, p.deviceHash),
        p.variantId ? eq(scans.variantId, p.variantId) : isNull(scans.variantId),
      ),
    )
    .orderBy(desc(scans.at))
    .limit(1);
  if (!shouldCountScan(last?.at ?? null, now)) return { counted: false, reason: "repetida" };
  await ex.insert(scans).values({ restaurantId: p.restaurantId, variantId: p.variantId, deviceHash: p.deviceHash, at: now, daySp: daySP(now) });
  return { counted: true };
}
