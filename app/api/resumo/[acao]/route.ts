/**
 * Links do resumo semanal (S6.1 — D187, D193): só POST (robôs que abrem links de e-mail não aprovam nem desligam
 * nada), mesma origem + JSON, limite por IP. O token é a autorização (sem sessão): aprovar queima o token na mesma
 * transação; "parar" desliga só o resumo daquele restaurante. Flag `resumo_email` desligada → 404.
 */
import { z } from "zod";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { approveByDigest, stopDigest } from "@/src/modules/planos/application/digest";
import { latestPlan } from "@/src/modules/planos/application/approve-plan";
import { hasContactInfo } from "@/src/modules/salao/domain/contact-info";
import { overLimit, rejectCrossSite } from "@/src/web/guards";
import { scheduleInviteEmails } from "@/src/web/invite-emails";

export const dynamic = "force-dynamic";

const body = z.object({ t: z.string().min(10).max(400) });

export async function POST(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const limited = await overLimit(req, "resumo");
  if (limited) return limited;
  if (!(await getFlags(getDb())).resumo_email) return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  const { acao } = await ctx.params;
  const b = body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
  const now = new Date();
  if (acao === "aprovar") {
    const r = await approveByDigest(getDb(), { token: b.data.t, now });
    if (!r.ok) return Response.json(r, { status: r.erro === "invalido" ? 404 : 409 });
    if (r.inviteIds.length) scheduleInviteEmails(r.restaurantId, r.inviteIds);
    // D174: convite com link ou contato vai só para o app.
    const plan = await latestPlan(getDb(), r.restaurantId);
    const semEmail = ((plan?.choices ?? []) as Array<{ textoConvite: string }>).some((c) => hasContactInfo(c.textoConvite));
    return Response.json({ ok: true, already: r.already, sent: r.sent, semEmail });
  }
  if (acao === "parar") {
    const r = await stopDigest(getDb(), { token: b.data.t, now });
    return r.ok ? Response.json(r) : Response.json({ erro: "invalido" }, { status: 404 });
  }
  return Response.json({ erro: "nao_encontrado" }, { status: 404 });
}
