import { z } from "zod";
import { getDb } from "@/src/db/client";
import { confirmCode } from "@/src/modules/salao/application/validate-code";
import { consume } from "@/src/shared/rate-limit";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
const input = z.object({ codigo: z.string().max(20), chave: z.string().min(8).max(64) });

/** Confirmar código (idempotente pela chave — clique duplo = 1 efeito). */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const body = input.safeParse(await readJson(req));
  if (!body.success) return Response.json({ status: "INVALIDO" }, { status: 400 });
  const db = getDb();
  const now = new Date();
  const lim = await consume(db, `codigo:confirmar:${auth.s.owner.id}`, 30, 60, now);
  if (!lim.ok) return tooMany(lim.retryAfterSec);
  return Response.json(await confirmCode(db, { restaurantId: auth.r.id, raw: body.data.codigo, idempotencyKey: body.data.chave, now }));
}
