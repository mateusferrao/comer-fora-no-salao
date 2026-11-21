/** "Adicionar porta-conta" (S6.4 — D192): kits que já existem ganham a peça; flag `porta_conta` desligada → 404. */
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { addBillHolder, getKit } from "@/src/modules/kit/application/kit";
import { consume } from "@/src/shared/rate-limit";
import { rejectCrossSite } from "@/src/web/guards";
import { tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: false });
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const db = getDb();
  if (!(await getFlags(db)).porta_conta) return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  const now = new Date();
  const lim = await consume(db, `kit:porta-conta:${auth.r.id}`, 10, 3600, now);
  if (!lim.ok) return tooMany(lim.retryAfterSec);
  const r = await addBillHolder(db, { restaurantId: auth.r.id, now });
  if (!r.ok) return Response.json(r, { status: 409 });
  return Response.json(await getKit(db, auth.r.id, now));
}
