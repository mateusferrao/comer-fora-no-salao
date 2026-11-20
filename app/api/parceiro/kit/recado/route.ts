import { z } from "zod";
import { getDb } from "@/src/db/client";
import { editRecado } from "@/src/modules/kit/application/kit";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";

/** "Recado do restaurante" (aparece no card do benefício no app — print app/12). */
export async function PUT(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const body = z.object({ value: z.string().max(200) }).safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "formato" }, { status: 400 });
  const r = await editRecado(getDb(), { restaurantId: auth.r.id, value: body.data.value, now: new Date() });
  return r.ok ? Response.json(r) : Response.json(r, { status: 422 });
}
