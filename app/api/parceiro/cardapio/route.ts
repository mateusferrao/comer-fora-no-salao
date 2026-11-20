import { getDb } from "@/src/db/client";
import { menuInputSchema, saveMenu } from "@/src/modules/onboarding/application/wizard";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";

/** Passo 3: grava o cardápio revisado pelo dono. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore({ draft: true });
  if (auth instanceof Response) return auth;
  const body = menuInputSchema.safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "formato", detalhe: body.error.issues.slice(0, 3).map((i) => i.path.join(".")) }, { status: 400 });
  const r = await saveMenu(getDb(), auth.r.id, body.data, new Date());
  return r.ok ? Response.json(r) : Response.json({ erro: r.erro }, { status: 409 });
}
