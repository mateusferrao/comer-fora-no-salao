import { getDb } from "@/src/db/client";
import { getExtraction } from "@/src/modules/onboarding/application/extract-menu";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const v = await getExtraction(getDb(), auth.r.id, id, new Date());
  if (!v) return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  return Response.json({ id: v.id, source: v.source, status: v.status, result: v.result }, { headers: { "cache-control": "no-store" } });
}
