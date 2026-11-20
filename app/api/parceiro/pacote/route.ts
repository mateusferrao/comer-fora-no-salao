import { eq, and } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { weeklyPlans } from "@/src/db/schema";
import { finalPackageSchema } from "@/src/modules/onboarding/application/activate";
import { getPackageView, proposePackage } from "@/src/modules/onboarding/application/package";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const v = await getPackageView(getDb(), auth.r.id, new Date());
  return Response.json(v ?? { status: "vazio" }, { headers: { "cache-control": "no-store" } });
}

/** Passo 4: gera (ou "Gerar de novo") o pacote proposto. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: false });
  if (blocked) return blocked;
  const auth = await requireStore({ draft: true });
  if (auth instanceof Response) return auth;
  const r = await proposePackage(getDb(), { restaurantId: auth.r.id, ownerId: auth.s.owner.id, now: new Date() });
  if (!r.ok) return r.erro === "limite" ? tooMany(r.retryAfterSec) : Response.json({ erro: r.erro }, { status: 409 });
  return Response.json(await getPackageView(getDb(), auth.r.id, new Date()));
}

/** Guarda os ajustes do dono no rascunho (retomável entre o passo 4 e o 5). */
export async function PUT(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore({ draft: true });
  if (auth instanceof Response) return auth;
  const body = finalPackageSchema.safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "formato" }, { status: 400 });
  const db = getDb();
  const [plan] = await db.select().from(weeklyPlans).where(and(eq(weeklyPlans.restaurantId, auth.r.id), eq(weeklyPlans.status, "proposto")));
  if (!plan) return Response.json({ erro: "sem_pacote" }, { status: 409 });
  await db.update(weeklyPlans).set({ decision: { ...(plan.decision as object), draftFinal: body.data } }).where(eq(weeklyPlans.id, plan.id));
  return Response.json({ ok: true });
}
