import { z } from "zod";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { decideProposal } from "@/src/modules/agente/application/proposals";
import { consume } from "@/src/shared/rate-limit";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";
import { scheduleInviteEmails } from "@/src/web/invite-emails";

export const dynamic = "force-dynamic";

const body = z.object({ id: z.string().uuid(), acao: z.enum(["aplicar", "descartar"]) });

/** Aplicar ou descartar uma proposta do copiloto: só o clique do dono grava (D261), pela proposta guardada no banco. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const db = getDb();
  if (!(await getFlags(db)).copiloto) return Response.json({ erro: "desligado" }, { status: 404 });
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ erro: "formato" }, { status: 400 });
  const now = new Date();
  const lim = await consume(db, `copiloto:aplicar:${auth.r.id}`, 60, 3600, now);
  if (!lim.ok) return tooMany(lim.retryAfterSec);
  const r = await decideProposal(db, { restaurantId: auth.r.id, proposalId: parsed.data.id, origin: "copiloto", acao: parsed.data.acao, now, onApproved: (rid, ids) => scheduleInviteEmails(rid, ids) });
  return Response.json(r, { status: r.ok ? 200 : r.status === "nao_encontrada" ? 404 : 409 });
}
