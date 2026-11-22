import { z } from "zod";
import { getDb } from "@/src/db/client";
import { approvePiece, markInSalon } from "@/src/modules/kit/application/kit";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
const input = z.object({ pieceId: z.string().uuid(), acao: z.enum(["aprovar", "no_salao", "fora_do_salao"]) });

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const raw = await readJson(req);
  if (raw.erro === "grande") return tooLarge();
  const body = input.safeParse(raw.value);
  if (!body.success) return Response.json({ erro: "formato" }, { status: 400 });
  const now = new Date();
  if (body.data.acao === "aprovar") {
    const ok = await approvePiece(getDb(), { restaurantId: auth.r.id, pieceId: body.data.pieceId, now });
    if (ok === "revisor") return Response.json({ erro: "revisor" }, { status: 409 });
    return ok ? Response.json({ ok }) : Response.json({ erro: "nao_encontrado" }, { status: 404 });
  }
  const r = await markInSalon(getDb(), { restaurantId: auth.r.id, pieceId: body.data.pieceId, on: body.data.acao === "no_salao", now });
  return r.ok ? Response.json(r) : Response.json(r, { status: r.erro ? 409 : 404 });
}
