import { getDb } from "@/src/db/client";
import { saveSalon, salonInputSchema } from "@/src/modules/onboarding/application/wizard";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";

/** Passo 2: salão, funcionamento e horários vazios. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore({ draft: true });
  if (auth instanceof Response) return auth;
  const raw = await readJson(req);
  if (raw.erro === "grande") return tooLarge();
  const body = salonInputSchema.safeParse(raw.value);
  if (!body.success) return Response.json({ erro: "formato", detalhe: body.error.issues.slice(0, 3).map((i) => i.path.join(".")) }, { status: 400 });
  const r = await saveSalon(getDb(), auth.r.id, body.data, new Date());
  return r.ok ? Response.json(r) : Response.json(r, { status: 422 });
}
