import { z } from "zod";
import { getDb } from "@/src/db/client";
import { createTestRestaurant, deleteTestRestaurant } from "@/src/modules/onboarding/application/test-restaurants";
import { clientIp } from "@/src/shared/rate-limit-memory";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";
import { getOwnerSession, setCurrentRestaurant } from "@/src/web/owner-session";

export const dynamic = "force-dynamic";

/** "Cadastrar meu restaurante": restaurante em rascunho; vira a loja atual. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: false });
  if (blocked) return blocked;
  const s = await getOwnerSession();
  if (!s) return Response.json({ erro: "sessao" }, { status: 401 });
  const r = await createTestRestaurant(getDb(), { ownerId: s.owner.id, ip: clientIp(req.headers), now: new Date() });
  if (!r.ok) return r.erro === "limite" ? tooMany(r.retryAfterSec) : Response.json({ erro: r.erro }, { status: 409 });
  await setCurrentRestaurant(r.restaurantId);
  return Response.json({ ok: true, restaurantId: r.restaurantId });
}

const del = z.object({ restaurantId: z.string().uuid() });

/** "Excluir restaurante de teste" (Configurações; o E2E também usa para começar limpo). */
export async function DELETE(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const s = await getOwnerSession();
  if (!s) return Response.json({ erro: "sessao" }, { status: 401 });
  const body = del.safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "formato" }, { status: 400 });
  const ok = await deleteTestRestaurant(getDb(), { ownerId: s.owner.id, restaurantId: body.data.restaurantId });
  return ok ? Response.json({ ok: true }) : Response.json({ erro: "nao_encontrado" }, { status: 404 });
}
