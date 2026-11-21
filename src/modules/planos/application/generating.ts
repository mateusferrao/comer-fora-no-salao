/**
 * Estado `gerando` por restaurante (espec. 3.7.7): decidido sob lock da linha do restaurante, para que um clique
 * duplo gere 1 chamada de IA. Usado pelo pacote da ativação e pelo plano da semana.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { restaurants, weeklyPlans } from "@/src/db/schema";
import { consume } from "@/src/shared/rate-limit";
import { weekKeySP } from "@/src/shared/week";

export const GENERATING_STALE_MS = 90_000;

export type StartResult = { ok: true; planId: string } | { ok: false; erro: "gerando" | "limite"; retryAfterSec?: number };

export async function startGenerating(
  db: Db,
  p: { restaurantId: string; now: Date; limitKey: string; limit: number; exempt: boolean; clearStatuses: Array<"gerando" | "proposto" | "vencido"> },
): Promise<StartResult> {
  return db.transaction(async (tx) => {
    await tx.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.id, p.restaurantId)).for("update");
    const [busy] = await tx
      .select({ id: weeklyPlans.id, createdAt: weeklyPlans.createdAt })
      .from(weeklyPlans)
      .where(and(eq(weeklyPlans.restaurantId, p.restaurantId), eq(weeklyPlans.status, "gerando")))
      .orderBy(desc(weeklyPlans.createdAt))
      .limit(1);
    if (busy && p.now.getTime() - busy.createdAt.getTime() < GENERATING_STALE_MS) return { ok: false as const, erro: "gerando" as const };
    if (!p.exempt) {
      const lim = await consume(tx, p.limitKey, p.limit, 86_400, p.now);
      if (!lim.ok) return { ok: false as const, erro: "limite" as const, retryAfterSec: lim.retryAfterSec };
    }
    // S6 (D187): proposta que já foi por e-mail ("Revisar e aprovar") vira `vencido` em vez de sair, para o link
    // mostrar "Este plano foi substituído" (o token tem FK em cascata). O histórico só lista aprovados e descartados.
    if (p.clearStatuses.includes("proposto")) {
      await tx.execute(
        sql`update weekly_plans set status = 'vencido' where restaurant_id = ${p.restaurantId} and status = 'proposto' and exists (select 1 from digest_tokens d where d.plan_id = weekly_plans.id)`,
      );
    }
    // Rascunhos anteriores (não aprovados) saem; o histórico guarda só aprovados e descartados.
    await tx.delete(weeklyPlans).where(
      and(
        eq(weeklyPlans.restaurantId, p.restaurantId),
        inArray(weeklyPlans.status, p.clearStatuses),
        sql`not exists (select 1 from digest_tokens d where d.plan_id = ${weeklyPlans.id})`,
      ),
    );
    const [row] = await tx
      .insert(weeklyPlans)
      .values({ restaurantId: p.restaurantId, weekKey: weekKeySP(p.now), status: "gerando", facts: {}, candidates: [], choices: [], texts: {}, learned: [], createdAt: p.now })
      .returning({ id: weeklyPlans.id });
    return { ok: true as const, planId: row!.id };
  });
}
