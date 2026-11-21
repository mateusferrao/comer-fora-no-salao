/**
 * Resumo semanal no Portal (S6.1 — D188): "Ver o e-mail desta semana" (prévia com o link funcionando; POST porque
 * cria um token) e "Enviar agora" (até 3/dia, para o e-mail guardado do dono). Restaurante sempre da sessão.
 */
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { getMailSender } from "@/src/modules/contas/adapters/mail-factory";
import { previewDigest, sendDigestNow } from "@/src/modules/planos/application/digest";
import { rejectCrossSite } from "@/src/web/guards";
import { tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";
import { publicBaseUrl } from "@/src/web/qr";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const blocked = rejectCrossSite(req, { requireJson: false });
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  if (!(await getFlags(getDb())).resumo_email) return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  const { acao } = await ctx.params;
  const now = new Date();
  if (acao === "previa") {
    const r = await previewDigest(getDb(), { restaurantId: auth.r.id, now, baseUrl: publicBaseUrl() });
    if (!r.ok) return r.erro === "limite" ? tooMany(r.retryAfterSec) : Response.json(r, { status: 404 });
    return Response.json(r, { headers: { "cache-control": "no-store" } });
  }
  if (acao === "enviar") {
    const r = await sendDigestNow(getDb(), { restaurantId: auth.r.id, now, baseUrl: publicBaseUrl(), sender: getMailSender() });
    if (!r.ok) return r.erro === "limite" ? tooMany(r.retryAfterSec) : Response.json(r, { status: 409 });
    return Response.json(r);
  }
  return Response.json({ erro: "nao_encontrado" }, { status: 404 });
}
