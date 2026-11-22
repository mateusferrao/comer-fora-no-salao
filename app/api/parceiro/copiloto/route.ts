import { z } from "zod";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { runCopilotTurn } from "@/src/modules/agente/application/copilot-turn";
import { fakeCopilotEnabled, fakeCopilotGateway } from "@/src/modules/agente/adapters/fake-copilot-gateway";
import { keyKindFor } from "@/src/modules/ia/gateway-factory";
import { consume } from "@/src/shared/rate-limit";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({
  turns: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(1000) })).min(1).max(24),
  page: z.string().max(40).regex(/^[a-z0-9_/-]*$/),
  sessionId: z.string().uuid().optional(),
});

/** Um turno do Assistente do salão (S8 — D260). Só dono logado, restaurante da sessão, flag `copiloto`. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const db = getDb();
  if (!(await getFlags(db)).copiloto) return Response.json({ erro: "desligado" }, { status: 404 });
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success || parsed.data.turns.at(-1)!.role !== "user") return Response.json({ erro: "formato" }, { status: 400 });
  const now = new Date();
  const o = auth.s.owner;
  // Limites por restaurante (D271); E2E e apresentadores (chave demo) não travam no ensaio + demo (revisão de produto M3).
  // Revisão S8 (segurança 3): só E2E e apresentador ficam fora; quem entra pelo link do avaliador usa a chave demo
  // e também tem limite (o link abre contas novas).
  const presenter = o.via !== "link" && keyKindFor({ emailHmac: o.emailHmac ?? null, via: o.via ?? null }) === "demo";
  if (o.via !== "e2e" && !presenter) {
    const day = await consume(db, `copiloto:${auth.r.id}`, 60, 86_400, now);
    if (!day.ok) return tooMany(day.retryAfterSec);
    const burst = await consume(db, `copiloto:min:${auth.r.id}`, 10, 600, now);
    if (!burst.ok) return tooMany(burst.retryAfterSec);
  }
  const out = await runCopilotTurn(db, {
    restaurantId: auth.r.id,
    ownerId: o.id,
    turns: parsed.data.turns,
    page: parsed.data.page,
    now,
    ...(fakeCopilotEnabled(process.env) ? { gateway: fakeCopilotGateway() } : {}),
    ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {}),
  });
  return Response.json(out, { headers: { "cache-control": "no-store" } });
}
