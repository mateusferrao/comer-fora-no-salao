import { z } from "zod";
import { getDb } from "@/src/db/client";
import { findRestaurantBySlug } from "@/src/modules/salao/application/context";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { checkinViewSchema } from "@/src/modules/salao/application/views";
import { customerExists } from "@/src/modules/salao/application/identify-customer";
import { findVariantByToken } from "@/src/modules/salao/application/register-scan";
import { GPS_STATUSES } from "@/src/modules/salao/domain/geo";
import { secureRandInt } from "@/src/shared/crypto";
import { systemClock } from "@/src/shared/clock";
import { readCustomerId } from "@/src/web/customer-session";
import { safeErr } from "@/src/shared/safe-err";
import { isE2eRestaurant, overLimit, rejectCrossSite } from "@/src/web/guards";
import { log } from "@/src/shared/log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  gpsStatus: z.enum(GPS_STATUSES),
  idempotencyKey: z.string().uuid(),
  p: z.string().max(64).optional(),
});

/** Check-in (espec. 3.5.4): o cliente vem do cookie; a resposta só tem campos permitidos (P-I7). */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ erro: "dados_invalidos" }, { status: 400 });
  const db = getDb();
  const r = await findRestaurantBySlug(db, slug);
  if (!r || r.status !== "ativo") return Response.json({ erro: "restaurante_inexistente" }, { status: 404 });
  const limited = (await isE2eRestaurant(r)) ? null : await overLimit(req, "checkin");
  if (limited) return limited;
  const customerId = await readCustomerId();
  // Sem cookie válido, ou cliente apagado (vitrine recriada): volta para a identificação, nunca 500 (P-I2).
  if (!customerId || !(await customerExists(db, customerId))) return Response.json({ erro: "identificacao" }, { status: 401 });
  try {
    const variantId = await findVariantByToken(db, r.id, parsed.data.p);
    const view = await doCheckin(db, {
      restaurantId: r.id,
      customerId,
      gpsStatus: parsed.data.gpsStatus,
      variantId,
      idempotencyKey: parsed.data.idempotencyKey,
      clock: systemClock,
      randInt: secureRandInt,
    });
    return Response.json(checkinViewSchema.parse(view), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    log.error("falhou", { area: "checkin", err: safeErr(err) });
    return Response.json({ erro: "falha" }, { status: 500 });
  }
}
