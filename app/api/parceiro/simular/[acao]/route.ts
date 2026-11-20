/** "Simular 30 dias" / "Limpar simulação" (restaurante de teste — espec. 3.6). Selo "simulado" na tela. */
import { getDb } from "@/src/db/client";
import { clearTest, simulateTest } from "@/src/modules/simulacao/application/simulate-test";
import { consume } from "@/src/shared/rate-limit";
import { rejectCrossSite } from "@/src/web/guards";
import { tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const { acao } = await ctx.params;
  const now = new Date();
  if (acao === "simular") {
    if (auth.s.owner.via !== "e2e") {
      const lim = await consume(getDb(), `simular:${auth.s.owner.id}`, 6, 86_400, now);
      if (!lim.ok) return tooMany(lim.retryAfterSec);
    }
    const r = await simulateTest(getDb(), { restaurantId: auth.r.id, now });
    return r.ok ? Response.json(r) : Response.json(r, { status: 409 });
  }
  if (acao === "limpar") {
    if (auth.r.kind !== "teste") return Response.json({ erro: "nao_teste" }, { status: 409 });
    return Response.json(await clearTest(getDb(), { restaurantId: auth.r.id }));
  }
  return Response.json({ erro: "nao_encontrado" }, { status: 404 });
}
