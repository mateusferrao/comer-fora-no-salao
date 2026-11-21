import { getDb } from "@/src/db/client";
import { activate, finalPackageSchema } from "@/src/modules/onboarding/application/activate";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";
import { afterActivation } from "@/src/web/after-activation";

export const dynamic = "force-dynamic";

/** Passo 5: "Ativar Comer Fora no salão" (idempotente). Em seguida, o kit começa a ser gerado (revisão P-I1). */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  if (auth.r.kind !== "teste") return Response.json({ erro: "ja_ativo" }, { status: 409 });
  const body = finalPackageSchema.safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "formato" }, { status: 400 });
  const r = await activate(getDb(), { restaurantId: auth.r.id, final: body.data, now: new Date() });
  if (!r.ok) return Response.json(r, { status: 422 });
  if (!r.already) afterActivation(auth.r.id, auth.s.owner.id);
  return Response.json(r);
}
