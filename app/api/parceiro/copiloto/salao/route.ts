import { z } from "zod";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { readSalonSentence } from "@/src/modules/agente/application/salon-sentence";
import { fakeCopilotEnabled, fakeCopilotGateway } from "@/src/modules/agente/adapters/fake-copilot-gateway";
import { consume } from "@/src/shared/rate-limit";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
export const maxDuration = 40;

const body = z.object({ texto: z.string().trim().min(10).max(600) });

/** Passo 2 da ativação: a frase do dono vira preenchimento do formulário (S8 — D265). Não grava nada. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const db = getDb();
  if (!(await getFlags(db)).copiloto) return Response.json({ erro: "desligado" }, { status: 404 });
  const auth = await requireStore({ draft: true });
  if (auth instanceof Response) return auth;
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ erro: "formato" }, { status: 400 });
  const now = new Date();
  if (auth.s.owner.via !== "e2e") {
    const lim = await consume(db, `salao-frase:${auth.r.id}`, 10, 86_400, now);
    if (!lim.ok) return tooMany(lim.retryAfterSec);
  }
  const r = await readSalonSentence(db, { restaurantId: auth.r.id, ownerId: auth.s.owner.id, text: parsed.data.texto, now, ...(fakeCopilotEnabled(process.env) ? { gateway: fakeCopilotGateway() } : {}) });
  return Response.json(r, { headers: { "cache-control": "no-store" } });
}
