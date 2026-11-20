import { z } from "zod";
import { getDb } from "@/src/db/client";
import { advanceInvite } from "@/src/modules/salao/application/advance-invite";
import { consume } from "@/src/shared/rate-limit";
import { readCustomerId } from "@/src/web/customer-session";
import { rejectCrossSite } from "@/src/web/guards";
import { tooMany } from "@/src/web/http";

export const dynamic = "force-dynamic";
const body = z.object({ inviteId: z.string().uuid() });

/** "Para testar: antecipar 1 dia" (D140, D141): só o convite do próprio cookie, só em restaurante de teste. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const customerId = await readCustomerId();
  if (!customerId) return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  const b = body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
  const now = new Date();
  const lim = await consume(getDb(), `antecipar:${customerId}`, 10, 3600, now);
  if (!lim.ok) return tooMany(lim.retryAfterSec);
  const r = await advanceInvite(getDb(), { customerId, inviteId: b.data.inviteId, now });
  if (r.ok) return Response.json(r);
  return Response.json(r, { status: r.erro === "nao_se_aplica" ? 409 : 404 });
}
