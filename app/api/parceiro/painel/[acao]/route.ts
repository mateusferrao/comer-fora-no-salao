/**
 * Leituras do painel (polling ~3 s — D48). Despacho por segmento para conter o build (revisão T-I4).
 * Só leitura: não consome limites (o polling não grava em `rate_limits` a cada chamada).
 */
import { z } from "zod";
import { getDb } from "@/src/db/client";
import { getDashboard, getFunnel, getLatestCheckin } from "@/src/modules/analytics/application/dashboard";
import { getSegments } from "@/src/modules/analytics/application/customers";
import { SEGMENTS } from "@/src/modules/analytics/domain/segments";
import { daySP } from "@/src/shared/tz";
import { requireStore } from "@/src/web/portal-guards";
import { getFlags } from "@/src/modules/config/application/app-config";

export const dynamic = "force-dynamic";

const period = z.enum(["hoje", "7d", "30d"]).catch("7d");
const noStore = { headers: { "cache-control": "no-store" } };

export async function GET(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const { acao } = await ctx.params;
  const u = new URL(req.url);
  const now = new Date();
  const variant = z.string().uuid().safeParse(u.searchParams.get("peca") ?? undefined);
  // S5.1: a flag é lida a cada chamada (corte por flag sem recarregar a página).
  const painelValor = acao === "resumo" || acao === "funil" ? (await getFlags(getDb())).painel_valor : false;
  switch (acao) {
    case "resumo":
      return Response.json(await getDashboard(getDb(), auth.r.id, now, { period: period.parse(u.searchParams.get("periodo")), variantId: variant.success ? variant.data : undefined, painelValor }), noStore);
    case "funil":
      return Response.json(await getFunnel(getDb(), auth.r.id, daySP(now), period.parse(u.searchParams.get("periodo")), variant.success ? variant.data : undefined, now, { feed: painelValor }), noStore);
    case "eventos": {
      // `desde` limitado à última hora (valor absurdo não derruba a rota — revisão S3).
      const raw = Number(u.searchParams.get("desde"));
      const since = new Date(Number.isFinite(raw) && raw > 0 ? Math.min(now.getTime(), Math.max(now.getTime() - 3_600_000, raw)) : now.getTime() - 60_000);
      return Response.json({ last: await getLatestCheckin(getDb(), auth.r.id, since) }, noStore);
    }
    case "clientes": {
      const seg = z.enum(SEGMENTS as [string, ...string[]]).catch("sumiu").parse(u.searchParams.get("segmento"));
      return Response.json(await getSegments(getDb(), auth.r.id, now, seg as (typeof SEGMENTS)[number]), noStore);
    }
    default:
      return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  }
}
