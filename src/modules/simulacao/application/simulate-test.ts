/**
 * "Simular 30 dias" e "Limpar simulação" no restaurante de teste (espec. 3.6, 3.8; planejamento S3 §4.2):
 * o mesmo gerador da vitrine (mesmas funções puras), com a regra vigente do restaurante.
 * - ids escopados pela rodada (`idScope = runId`) e semente derivada da rodada: dois restaurantes de teste no
 *   mesmo dia não colidem (revisão T-B1);
 * - termina no fim da semana ISO anterior: não gasta o teto da semana em curso (revisão T-B2);
 * - uma rodada por restaurante (índice único parcial), nunca em restaurante protegido (E2E) nem na vitrine.
 */
import { and, eq, ne, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { kitPieces, pieceVariants, restaurants, simulationRuns } from "@/src/db/schema";
import { unitCost } from "@/src/modules/beneficios/domain/offers";
import { loadContext } from "@/src/modules/salao/application/context";
import { hash32 } from "@/src/shared/hash32";
import { daySP } from "@/src/shared/tz";
import { addDaysSP, dayDiff, weekdayOfDay } from "@/src/shared/week";
import { simulate, VITRINE_SIM, type SimConvitePeriod } from "../domain/generator";
import { clearRun, persistSimulation } from "./persist";

export const TEST_SIM_DAYS = 30;
/** Clientes novos identificados por semana no teste [C]: menor que a vitrine (200), para caber no teto pequeno. */
export const TEST_SIM_WEEKLY_NEW = 120;

export type SimulateResult = { ok: true; runId: string } | { ok: false; erro: "nao_teste" | "ja_simulado" | "inativo" | "nao_encontrado" };

/** Segunda-feira da semana ISO (SP) de um dia. */
function mondayOf(day: string): string {
  return addDaysSP(day, -((weekdayOfDay(day) + 6) % 7));
}

export async function simulateTest(db: Db, p: { restaurantId: string; now: Date }): Promise<SimulateResult> {
  const ctx = await loadContext(db, p.restaurantId);
  if (!ctx) return { ok: false, erro: "nao_encontrado" };
  const r = ctx.restaurant;
  if (r.kind !== "teste" || r.protected) return { ok: false, erro: "nao_teste" };
  if (r.status !== "ativo" || !ctx.agora || !ctx.recompensa) return { ok: false, erro: "inativo" };
  const endDay = mondayOf(daySP(p.now)); // exclusivo: a simulação vai até o domingo passado
  const startDay = addDaysSP(endDay, -TEST_SIM_DAYS);
  const margin = r.marginPct ?? undefined;
  const convites: SimConvitePeriod[] = ctx.slots
    .filter((s) => ctx.convites[s.id]?.weeklyCap != null)
    .map((s) => {
      const v = ctx.convites[s.id]!;
      return { slotId: s.id, versionId: v.versionId, itemId: v.offer.params.itemId, unitCostCents: unitCost(v.offer, ctx.menu, margin).cents, cap: v.weeklyCap!, fromDay: startDay, toDay: null };
    });
  const tokens = await db
    .select({ token: pieceVariants.qrToken })
    .from(pieceVariants)
    .innerJoin(kitPieces, eq(kitPieces.id, pieceVariants.pieceId))
    .where(and(eq(pieceVariants.restaurantId, p.restaurantId), ne(kitPieces.kind, "garcom")));
  return db.transaction(async (tx) => {
    await tx.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.id, p.restaurantId)).for("update");
    const [exists] = await tx.select({ id: simulationRuns.id }).from(simulationRuns).where(and(eq(simulationRuns.restaurantId, p.restaurantId), eq(simulationRuns.kind, "botao"))).limit(1);
    if (exists) return { ok: false as const, erro: "ja_simulado" as const };
    const runId = crypto.randomUUID();
    const params = { ...VITRINE_SIM, seed: hash32(runId) % 2_000_000_000, startDay, days: dayDiff(startDay, endDay), weeklyNew: TEST_SIM_WEEKLY_NEW };
    await tx.insert(simulationRuns).values({ id: runId, restaurantId: p.restaurantId, kind: "botao", seed: params.seed, version: 1, params });
    const out = simulate(
      { id: p.restaurantId, slots: ctx.slots, agora: { versionId: ctx.agora!.versionId, itemId: ctx.agora!.offer.params.itemId }, recompensa: { versionId: ctx.recompensa!.versionId, itemId: ctx.recompensa!.offer.params.itemId }, convites, variantTokens: tokens.map((t) => t.token) },
      params,
    );
    await tx.execute(sql`set local statement_timeout = '60s'`);
    await persistSimulation(tx, { restaurantId: p.restaurantId, runId, out, planIdBySendKey: {}, now: p.now, params, idScope: runId });
    return { ok: true as const, runId };
  });
}

export async function clearTest(db: Db, p: { restaurantId: string }): Promise<{ ok: true; cleared: number }> {
  return db.transaction(async (tx) => {
    const runs = await tx.select({ id: simulationRuns.id }).from(simulationRuns).where(and(eq(simulationRuns.restaurantId, p.restaurantId), eq(simulationRuns.kind, "botao")));
    for (const r of runs) await clearRun(tx, r.id);
    return { ok: true as const, cleared: runs.length };
  });
}
