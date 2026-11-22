/**
 * Plano da semana (espec. 3.7; planejamento S3 §4.3): ver, gerar, aprovar e descartar. Restaurante sempre da sessão.
 */
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/src/db/client";
import { approvePlan, discardPlan, finalPlanSchema } from "@/src/modules/planos/application/approve-plan";
import { hasContactInfo } from "@/src/modules/salao/domain/contact-info";
import { scheduleInviteEmails } from "@/src/web/invite-emails";
import { generateWeeklyPlan } from "@/src/modules/planos/application/generate-plan";
import { getPlanView } from "@/src/modules/planos/application/plan-view";
import { explainOffer } from "@/src/modules/planos/application/explain-offer";
import { getFlags } from "@/src/modules/config/application/app-config";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge, tooMany } from "@/src/web/http";
import { consume } from "@/src/shared/rate-limit";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const approveBody = z.object({ planId: z.string().uuid(), final: finalPlanSchema });
const discardBody = z.object({ planId: z.string().uuid(), reason: z.enum(["ofertas", "teto", "manter", "outro"]), text: z.string().max(200).optional() });

const explainQuery = z.object({ plano: z.string().uuid(), faixa: z.string().uuid() });

export async function GET(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const acao = (await ctx.params).acao;
  // S5.3 (flag explica_ia): "Por que esta oferta?" — vale no plano e no pacote da ativação (restaurante em rascunho).
  if (acao === "explicar") {
    // Qualquer loja da sessão (ativa ou em ativação); o plano é sempre buscado com o restaurante dela.
    const auth = await requireStore();
    if (auth instanceof Response) return auth;
    if (!(await getFlags(getDb())).explica_ia) return Response.json({ erro: "nao_encontrado" }, { status: 404 });
    const u = new URL(req.url);
    const q = explainQuery.safeParse({ plano: u.searchParams.get("plano"), faixa: u.searchParams.get("faixa") });
    const e = q.success ? await explainOffer(getDb(), auth.r.id, q.data.plano, q.data.faixa) : null;
    return e ? Response.json(e, { headers: { "cache-control": "no-store" } }) : Response.json({ erro: "nao_encontrado" }, { status: 404 });
  }
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  if (acao !== "ver") return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  return Response.json(await getPlanView(getDb(), auth.r.id, new Date()), { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const { acao } = await ctx.params;
  const now = new Date();
  const raw = await readJson(req);
  if (raw.erro === "grande") return tooLarge();
  const body = raw.value;
  // Toda rota que grava tem limite (regras.md): aprovar e descartar, 30/h por restaurante (gerar tem o seu, 10/dia).
  if (acao === "aprovar" || acao === "descartar") {
    const lim = await consume(getDb(), `plano:${acao}:${auth.r.id}`, 30, 3600, now);
    if (!lim.ok) return tooMany(lim.retryAfterSec);
  }
  if (acao === "gerar") {
    const r = await generateWeeklyPlan(getDb(), { restaurantId: auth.r.id, ownerId: auth.s.owner.id, now, schedule: (fn) => after(fn) });
    if (!r.ok) return r.erro === "limite" ? tooMany(r.retryAfterSec ?? 3600) : Response.json({ erro: r.erro }, { status: 409 });
    return Response.json(r);
  }
  if (acao === "aprovar") {
    const b = approveBody.safeParse(body);
    if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
    const r = await approvePlan(getDb(), { restaurantId: auth.r.id, planId: b.data.planId, final: b.data.final, via: "portal", now });
    if (!r.ok) return Response.json(r, { status: r.erro === "nao_encontrado" ? 404 : 409 });
    if (r.inviteIds?.length) scheduleInviteEmails(auth.r.id, r.inviteIds);
    // D174: convite com link, telefone ou e-mail no texto vai só para o app; o dono é avisado.
    const semEmail = b.data.final.slots.some((s) => hasContactInfo(s.inviteText));
    return Response.json({ ...r, semEmail });
  }
  if (acao === "descartar") {
    const b = discardBody.safeParse(body);
    if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
    const r = await discardPlan(getDb(), { restaurantId: auth.r.id, planId: b.data.planId, reason: b.data.reason, text: b.data.text, now });
    return r.ok ? Response.json(r) : Response.json(r, { status: r.erro === "nao_encontrado" ? 404 : 409 });
  }
  return Response.json({ erro: "nao_encontrado" }, { status: 404 });
}
