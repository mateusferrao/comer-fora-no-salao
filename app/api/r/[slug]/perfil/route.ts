import { getDb } from "@/src/db/client";
import { findRestaurantBySlug } from "@/src/modules/salao/application/context";
import { profileInputSchema, saveCustomerProfile } from "@/src/modules/salao/application/customer-login";
import { readCustomerId } from "@/src/web/customer-session";
import { isE2eRestaurant, overLimit, rejectCrossSite } from "@/src/web/guards";
import { readJson } from "@/src/web/http";

export const dynamic = "force-dynamic";

/** Login do cliente, passo 2 (só quem é novo — D173): nome, telefone opcional e interruptores deste restaurante. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const parsed = profileInputSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    const campos = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "")))];
    return Response.json({ erro: "dados_invalidos", campos }, { status: 400 });
  }
  const db = getDb();
  const r = await findRestaurantBySlug(db, slug);
  if (!r || r.status !== "ativo") return Response.json({ erro: "restaurante_inexistente" }, { status: 404 });
  const limited = (await isE2eRestaurant(r)) ? null : await overLimit(req, "identificacao");
  if (limited) return limited;
  const customerId = await readCustomerId();
  if (!customerId) return Response.json({ erro: "identificacao" }, { status: 401 });
  const res = await saveCustomerProfile(db, { restaurantId: r.id, customerId, now: new Date(), ...parsed.data });
  if (!res.ok) return Response.json({ erro: res.erro === "sem_cliente" ? "identificacao" : res.erro }, { status: res.erro === "sem_cliente" ? 401 : 400 });
  return Response.json({ ok: true });
}
