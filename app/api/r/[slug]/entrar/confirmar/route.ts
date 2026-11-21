import { z } from "zod";
import { getDb } from "@/src/db/client";
import { findRestaurantBySlug } from "@/src/modules/salao/application/context";
import { confirmCustomerCode, customerSession } from "@/src/modules/salao/application/customer-login";
import { clientIp } from "@/src/shared/rate-limit-memory";
import { writeCustomerId } from "@/src/web/customer-session";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";

export const dynamic = "force-dynamic";

const input = z.object({ email: z.string().max(320), code: z.string().max(12) });

/** Login do cliente, passo 1b: confere o código, grava o cookie e diz o próximo passo (perfil, consentir ou pronto). */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = input.safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "dados_invalidos" }, { status: 400 });
  const db = getDb();
  const r = await findRestaurantBySlug(db, slug);
  if (!r || r.status !== "ativo") return Response.json({ erro: "restaurante_inexistente" }, { status: 404 });
  const v = await confirmCustomerCode(db, { restaurantId: r.id, email: body.data.email, code: body.data.code, ip: clientIp(req.headers), now: new Date() });
  if (!v.ok) {
    if (v.erro === "limite") return tooMany(v.retryAfterSec);
    return Response.json({ erro: v.erro, ...(v.restantes !== undefined ? { restantes: v.restantes } : {}) }, { status: 400 });
  }
  await writeCustomerId(v.customerId);
  const s = await customerSession(db, r.id, v.customerId);
  return Response.json({ ok: true, etapa: s.state === "entrar" ? "perfil" : s.state });
}
