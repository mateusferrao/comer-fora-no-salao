import { z } from "zod";
import { getDb } from "@/src/db/client";
import { findRestaurantBySlug } from "@/src/modules/salao/application/context";
import { findVariantByToken, registerScan } from "@/src/modules/salao/application/register-scan";
import { hashDevice } from "@/src/shared/crypto";
import { systemClock } from "@/src/shared/clock";
import { readDeviceId } from "@/src/web/customer-session";
import { overLimit, rejectCrossSite } from "@/src/web/guards";

export const dynamic = "force-dynamic";
const bodySchema = z.object({ p: z.string().max(64).optional() });

/** Beacon de leitura do QR (D49): chamado pelo navegador depois de abrir a página, nunca pelo GET. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blocked = rejectCrossSite(req) ?? (await overLimit(req, "leitura"));
  if (blocked) return blocked;
  // Sem o cookie do aparelho (criado ao abrir a página), a leitura não conta: evita inflar a contagem com scripts.
  const device = await readDeviceId();
  if (!device) return new Response(null, { status: 204 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new Response(null, { status: 400 });
  const db = getDb();
  const r = await findRestaurantBySlug(db, slug);
  if (!r) return new Response(null, { status: 404 });
  const variantId = await findVariantByToken(db, r.id, parsed.data.p);
  if (parsed.data.p && !variantId) return new Response(null, { status: 204 }); // token inválido: não registra
  await registerScan(db, { restaurantId: r.id, variantId, deviceHash: hashDevice(device), userAgent: req.headers.get("user-agent"), clock: systemClock });
  return new Response(null, { status: 204 });
}
