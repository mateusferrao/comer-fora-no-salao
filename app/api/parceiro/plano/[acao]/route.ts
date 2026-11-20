/**
 * Plano da semana (espec. 3.7; planejamento S3 §4.3): ver, gerar, aprovar e descartar. Restaurante sempre da sessão.
 */
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/src/db/client";
import { approvePlan, discardPlan, finalPlanSchema } from "@/src/modules/planos/application/approve-plan";
import { generateWeeklyPlan } from "@/src/modules/planos/application/generate-plan";
import { getPlanView } from "@/src/modules/planos/application/plan-view";
import { rejectCrossSite } from "@/src/web/guards";
import { tooMany } from "@/src/web/http";
import { consume } from "@/src/shared/rate-limit";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const approveBody = z.object({ planId: z.string().uuid(), final: finalPlanSchema });
const discardBody = z.object({ planId: z.string().uuid(), reason: z.enum(["ofertas", "teto", "manter", "outro"]), text: z.string().max(200).optional() });

export async function GET(_req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  if ((await ctx.params).acao !== "ver") return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  return Response.json(await getPlanView(getDb(), auth.r.id, new Date()), { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const { acao } = await ctx.params;
  const now = new Date();
  const body = await req.json().catch(() => null);
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
    return r.ok ? Response.json(r) : Response.json(r, { status: r.erro === "nao_encontrado" ? 404 : 409 });
  }
  if (acao === "descartar") {
    const b = discardBody.safeParse(body);
    if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
    const r = await discardPlan(getDb(), { restaurantId: auth.r.id, planId: b.data.planId, reason: b.data.reason, text: b.data.text, now });
    return r.ok ? Response.json(r) : Response.json(r, { status: r.erro === "nao_encontrado" ? 404 : 409 });
  }
  return Response.json({ erro: "nao_encontrado" }, { status: 404 });
}
