import { z } from "zod";
import { getDb } from "@/src/db/client";
import { findRestaurantBySlug } from "@/src/modules/salao/application/context";
import { customerSession, giveConsent } from "@/src/modules/salao/application/customer-login";
import { readCustomerId } from "@/src/web/customer-session";
import { isE2eRestaurant, overLimit, rejectCrossSite } from "@/src/web/guards";
import { readJson } from "@/src/web/http";

export const dynamic = "force-dynamic";

const input = z.object({ optEmail: z.boolean(), optApp: z.boolean() });

/** Cliente já logado, 1ª vez neste restaurante (revisão S4 I1): aceite com 1 toque e os interruptores daqui. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = input.safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "dados_invalidos" }, { status: 400 });
  const db = getDb();
  const r = await findRestaurantBySlug(db, slug);
  if (!r || r.status !== "ativo") return Response.json({ erro: "restaurante_inexistente" }, { status: 404 });
  const limited = (await isE2eRestaurant(r)) ? null : await overLimit(req, "identificacao");
  if (limited) return limited;
  const customerId = await readCustomerId();
  const s = await customerSession(db, r.id, customerId);
  if (s.state === "entrar" || s.state === "perfil") return Response.json({ erro: "identificacao" }, { status: 401 });
  await giveConsent(db, { restaurantId: r.id, customerId: customerId!, now: new Date(), ...body.data });
  return Response.json({ ok: true });
}
