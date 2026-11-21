/**
 * Ferramentas do avaliador (D153; S4 §4.6) — fora do produto. Exigem a sessão do dono e só agem nos restaurantes
 * dele. A conta do E2E (D123) também pode avançar o restaurante E2E fixo (E2E de produção).
 */
import { z } from "zod";
import { getDb } from "@/src/db/client";
import { E2E_SLUG } from "@/src/db/seed/e2e";
import { advanceRestaurantOneDay, pickReactivatedCustomer } from "@/src/modules/salao/application/evaluator-tools";
import { findRestaurantBySlug } from "@/src/modules/salao/application/context";
import { writeCustomerId } from "@/src/web/customer-session";
import { overLimit, rejectCrossSite } from "@/src/web/guards";
import { readJson } from "@/src/web/http";
import { getOwnerSession } from "@/src/web/owner-session";
import { and, eq } from "drizzle-orm";
import { restaurants } from "@/src/db/schema";
import { runSchedulerTick } from "@/src/modules/agendador/application/tick";
import { tickDeps } from "@/src/web/scheduler";

export const dynamic = "force-dynamic";

const avancar = z.object({ restaurantId: z.string().uuid().optional(), slug: z.string().max(80).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const s = await getOwnerSession();
  if (!s) return Response.json({ erro: "sessao" }, { status: 401 });
  const limited = s.owner.via === "e2e" ? null : await overLimit(req, "trocar");
  if (limited) return limited;
  const { acao } = await ctx.params;
  const db = getDb();
  const now = new Date();
  if (acao === "avancar") {
    const body = avancar.safeParse(await readJson(req));
    if (!body.success) return Response.json({ erro: "dados_invalidos" }, { status: 400 });
    let restaurantId = body.data.restaurantId;
    let allowE2e = false;
    if (body.data.slug === E2E_SLUG && s.owner.via === "e2e") {
      const r = await findRestaurantBySlug(db, E2E_SLUG);
      restaurantId = r?.id;
      allowE2e = true;
    }
    if (!restaurantId) return Response.json({ erro: "dados_invalidos" }, { status: 400 });
    const res = await advanceRestaurantOneDay(db, { ownerId: s.owner.id, restaurantId, now, allowE2eRestaurant: allowE2e });
    if (!res.ok) return Response.json({ erro: res.erro }, { status: res.erro === "nao_e_seu" ? 403 : 409 });
    return Response.json(res);
  }
  // S6.1: "Rodar o ciclo agora neste restaurante" — plano automático, resumo (se houver e-mail) e lembretes, sem
  // esperar o horário; só no restaurante dado e só se for do dono da sessão (revisão de produto B1).
  if (acao === "ciclo") {
    const body = avancar.safeParse(await readJson(req));
    const rid = body.success ? body.data.restaurantId : undefined;
    if (!rid) return Response.json({ erro: "dados_invalidos" }, { status: 400 });
    const [mine] = await db.select({ id: restaurants.id }).from(restaurants).where(and(eq(restaurants.id, rid), eq(restaurants.ownerId, s.owner.id)));
    if (!mine) return Response.json({ erro: "nao_e_seu" }, { status: 403 });
    const r = await runSchedulerTick(db, now, await tickDeps(), { restaurantId: rid });
    return Response.json({ ok: true, ...r });
  }
  if (acao === "reativado") {
    const customerId = await pickReactivatedCustomer(db, { ownerId: s.owner.id, now });
    if (!customerId) return Response.json({ erro: "sem_reativacao" }, { status: 409 });
    await writeCustomerId(customerId);
    return Response.json({ ok: true });
  }
  return Response.json({ erro: "nao_encontrado" }, { status: 404 });
}
