/**
 * Cópia da vitrine por conta (D119): mesmo conteúdo e mesmos 60 dias (mesma semente, simulada com o id da
 * vitrine original), ids remapeados e tokens com sufixo (revisão T-B1). Serializada no processo e no pool
 * do seed (1 conexão, 120 s); estado em `restaurants.setup_status` (criando → pronta | falhou).
 */
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getSeedDb } from "@/src/db/client";
import type { Db } from "@/src/db/client";
import { restaurants, simulationRuns } from "@/src/db/schema";
import { buildRestaurant } from "@/src/db/seed/builder";
import { makeVitrineHistory } from "@/src/db/seed/history";
import { SEED_VERSION } from "@/src/db/seed";
import { VITRINE_ID, vitrineSpec } from "@/src/db/seed/vitrine";
import { VITRINE_SIM } from "@/src/modules/simulacao/domain/generator";
import { randomSuffix } from "@/src/modules/onboarding/application/test-restaurants";
import { safeErr } from "@/src/shared/safe-err";
import { log } from "@/src/shared/log";

export const COPY_STALE_MS = 120_000;
const DAY_MS = 86_400_000;

type G = { __salaoCopyQueue?: Promise<unknown> };
const g = globalThis as typeof globalThis & G;

/** Fila no processo: cópias simultâneas de várias contas não disputam a única conexão do pool do seed. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = (g.__salaoCopyQueue ?? Promise.resolve()).then(task, task);
  g.__salaoCopyQueue = run.catch(() => {});
  return run;
}

export type CopyResult = "criada" | "existente" | "falhou";

export function copyVitrineFor(ownerId: string, now: Date = new Date(), db: Db = getSeedDb()): Promise<CopyResult> {
  return enqueue(() => doCopy(db, ownerId, now));
}

async function doCopy(db: Db, ownerId: string, now: Date): Promise<CopyResult> {
  const suffix = randomSuffix(6);
  const id = crypto.randomUUID();
  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"copia:" + ownerId}))`);
    const [existing] = await tx
      .select({ id: restaurants.id, status: restaurants.setupStatus, startedAt: restaurants.setupStartedAt })
      .from(restaurants)
      .where(and(eq(restaurants.ownerId, ownerId), isNotNull(restaurants.copiedFrom)));
    if (existing) {
      const stale = existing.status === "criando" && (!existing.startedAt || now.getTime() - existing.startedAt.getTime() > COPY_STALE_MS);
      if (existing.status !== "falhou" && !stale) return false;
      await tx.delete(restaurants).where(eq(restaurants.id, existing.id));
    }
    await buildRestaurant(tx, vitrineSpec(new Date(now.getTime() - 60 * DAY_MS), { id, ownerId, slug: `cantina-nonna-lucia-${suffix}`, tokenSuffix: suffix, copy: true }));
    await tx.update(restaurants).set({ setupStartedAt: now }).where(eq(restaurants.id, id));
    return true;
  });
  if (!created) return "existente";
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local statement_timeout = '120s'`);
      const [run] = await tx.insert(simulationRuns).values({ restaurantId: id, kind: "vitrine", seed: VITRINE_SIM.seed, version: SEED_VERSION, params: { copia: true } }).returning({ id: simulationRuns.id });
      await makeVitrineHistory({ simRestaurantId: VITRINE_ID, tokenSuffix: suffix, idScope: id })(tx, { restaurantId: id, runId: run!.id, now });
      await tx.update(restaurants).set({ setupStatus: "pronta" }).where(eq(restaurants.id, id));
    });
    return "criada";
  } catch (err) {
    log.error("falha ao criar a vitrine da conta", { area: "copia", err: safeErr(err) });
    await db.update(restaurants).set({ setupStatus: "falhou" }).where(eq(restaurants.id, id)).catch(() => {});
    return "falhou";
  }
}

/** Estado da cópia para a tela (criando há mais de 120 s conta como falha — restart no meio). */
export function copyState(r: { setupStatus: string | null; setupStartedAt: Date | null } | undefined, now: Date): "nenhuma" | "criando" | "pronta" | "falhou" {
  if (!r) return "nenhuma";
  if (r.setupStatus === "criando") return r.setupStartedAt && now.getTime() - r.setupStartedAt.getTime() <= COPY_STALE_MS ? "criando" : "falhou";
  return r.setupStatus === "falhou" ? "falhou" : "pronta";
}
