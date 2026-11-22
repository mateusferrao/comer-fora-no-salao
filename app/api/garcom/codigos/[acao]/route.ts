/**
 * Validar código pelo link do garçom (S6.2 — D190): a mesma regra do Portal, com o restaurante da sessão do garçom
 * (revogação conferida a cada chamada). Limites por link: 30/min para consultar e 30/min para confirmar.
 */
import { z } from "zod";
import { getDb } from "@/src/db/client";
import { confirmCode, lookupCode } from "@/src/modules/salao/application/validate-code";
import { consume } from "@/src/shared/rate-limit";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge, tooMany } from "@/src/web/http";
import { readWaiterSession, writeWaiterSession } from "@/src/web/waiter-session";

export const dynamic = "force-dynamic";
const consultar = z.object({ codigo: z.string().max(20) });
const confirmar = z.object({ codigo: z.string().max(20), chave: z.string().min(8).max(64) });

export async function POST(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const s = await readWaiterSession();
  if (!s) return Response.json({ erro: "link" }, { status: 401 });
  // 30 dias renovados a cada uso (revisão S4–S6: o cookie só era gravado ao abrir o link).
  await writeWaiterSession(s.tokenId);
  const { acao } = await ctx.params;
  const db = getDb();
  const now = new Date();
  if (acao !== "consultar" && acao !== "confirmar") return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  const lim = await consume(db, `garcom:${acao}:${s.tokenId}`, 30, 60, now);
  if (!lim.ok) return tooMany(lim.retryAfterSec);
  const body = await readJson(req);
  if (body.erro === "grande") return tooLarge();
  const raw = body.value;
  if (acao === "consultar") {
    const b = consultar.safeParse(raw);
    if (!b.success) return Response.json({ status: "INVALIDO" }, { status: 400 });
    const r = await lookupCode(db, { ownerId: s.ownerId, restaurantId: s.restaurantId, raw: b.data.codigo, now });
    // O garçom vê só o restaurante dele: código de outra loja do mesmo dono = "não encontrado"; contato completo (D237).
    return Response.json(r.status === "OUTRO_RESTAURANTE" ? { status: "INVALIDO" } : r);
  }
  const b = confirmar.safeParse(raw);
  if (!b.success) return Response.json({ status: "INVALIDO" }, { status: 400 });
  const r = await confirmCode(db, { restaurantId: s.restaurantId, raw: b.data.codigo, idempotencyKey: b.data.chave, now });
  return Response.json(r.status === "OUTRO_RESTAURANTE" ? { status: "INVALIDO" } : r);
}
