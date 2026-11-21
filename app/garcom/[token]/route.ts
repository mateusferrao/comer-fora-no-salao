/**
 * Abrir o link do garçom (S6.2 — D190): confere o token, grava a sessão do garçom e redireciona para `/garcom`
 * (o token sai da barra de endereço e do histórico). Link inválido ou revogado → `/garcom` com a mensagem.
 */
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { resolveWaiterToken } from "@/src/modules/salao/application/waiter-tokens";
import { overLimit } from "@/src/web/guards";
import { writeWaiterSession } from "@/src/web/waiter-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const base = new URL("/garcom", req.url);
  const limited = await overLimit(req, "resumo");
  if (limited) return limited;
  if (!(await getFlags(getDb())).modo_garcom) return new Response("Não encontrado", { status: 404 });
  const { token } = await ctx.params;
  const t = await resolveWaiterToken(getDb(), token.slice(0, 120));
  if (!t) {
    base.searchParams.set("erro", "link");
    return Response.redirect(base, 303);
  }
  await writeWaiterSession(t.id);
  return new Response(null, { status: 303, headers: { location: "/garcom", "referrer-policy": "no-referrer", "cache-control": "no-store" } });
}
