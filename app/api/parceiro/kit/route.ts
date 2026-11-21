import { after } from "next/server";
import { getDb } from "@/src/db/client";
import { generateKit, getKit } from "@/src/modules/kit/application/kit";
import { rejectCrossSite } from "@/src/web/guards";
import { tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  return Response.json(await getKit(getDb(), auth.r.id, new Date()), { headers: { "cache-control": "no-store" } });
}

/** "Gerar meu kit" (se a geração automática depois de ativar não aconteceu). */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: false });
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const r = await generateKit(getDb(), { restaurantId: auth.r.id, ownerId: auth.s.owner.id, now: new Date(), schedule: (fn) => after(fn) });
  if (!r.ok) return r.erro === "limite" ? tooMany(3600) : Response.json({ erro: r.erro }, { status: 409 });
  return Response.json(await getKit(getDb(), auth.r.id, new Date()));
}
