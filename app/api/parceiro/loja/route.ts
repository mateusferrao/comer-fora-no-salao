import { z } from "zod";
import { getDb } from "@/src/db/client";
import { forRestaurant, NotOwnedError } from "@/src/modules/contas/application/owner-access";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge } from "@/src/web/http";
import { getOwnerSession, setCurrentRestaurant } from "@/src/web/owner-session";

export const dynamic = "force-dynamic";

const input = z.object({ restaurantId: z.string().max(64) });

/** Trocar loja: só um restaurante do próprio dono. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const s = await getOwnerSession();
  if (!s) return Response.json({ erro: "sessao" }, { status: 401 });
  const raw = await readJson(req);
  if (raw.erro === "grande") return tooLarge();
  const body = input.safeParse(raw.value);
  if (!body.success) return Response.json({ erro: "formato" }, { status: 400 });
  try {
    await forRestaurant(getDb(), s.owner.id, body.data.restaurantId);
  } catch (e) {
    if (e instanceof NotOwnedError) return Response.json({ erro: "nao_encontrado" }, { status: 404 });
    throw e;
  }
  await setCurrentRestaurant(body.data.restaurantId);
  return Response.json({ ok: true });
}
