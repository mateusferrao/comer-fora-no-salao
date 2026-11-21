/**
 * Seed no boot (planejamento S1 §4.4 + T-I2/T-I3): fora do `register` (não bloqueia o servidor),
 * com advisory lock (2 réplicas não semeiam juntas) e estado visível no health.
 * A vitrine é recriada quando a versão do seed muda (apaga a vitrine inteira, inclusive check-ins reais nela [C]).
 */
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Tx } from "@/src/db/executor";
import { restaurants, simulationRuns } from "@/src/db/schema";
import type { Clock } from "@/src/shared/clock";
import type { SeedStatus } from "@/src/shared/health";
import { safeErr } from "@/src/shared/safe-err";
import { buildRestaurant } from "./builder";
import { e2eSpec, E2E_SLUG } from "./e2e";
import { vitrineSpec, VITRINE_SLUG } from "./vitrine";
import { getSecret } from "@/src/shared/secrets";
import { VITRINE_SIM } from "@/src/modules/simulacao/domain/generator";
import { log } from "@/src/shared/log";

/** Suba ao mudar o conteúdo da vitrine ou o gerador da simulação. */
export const SEED_VERSION = 4; // S4: textos e nomes sem "fictício/teste" (D152); mesma semente e mesma sequência do gerador
const DAY_MS = 86_400_000;

export type VitrineHistory = (tx: Tx, p: { restaurantId: string; runId: string; now: Date }) => Promise<void>;

async function vitrineVersion(tx: Tx): Promise<number | null> {
  const [row] = await tx
    .select({ version: simulationRuns.version })
    .from(simulationRuns)
    .innerJoin(restaurants, eq(restaurants.id, simulationRuns.restaurantId))
    .where(and(eq(restaurants.slug, VITRINE_SLUG), eq(simulationRuns.kind, "vitrine")))
    .limit(1);
  return row?.version ?? null;
}

export async function seedAll(db: Db, clock: Clock, history?: VitrineHistory): Promise<{ vitrine: "criada" | "mantida"; e2e: "criado" | "mantido" }> {
  // Sem os segredos, o seed nem começa (o health mostra "falhou" e o deploy não fica verde por engano).
  getSecret("PHONE_HASH_SECRET");
  getSecret("SESSION_SECRET");
  const now = clock.now();
  // Restaurante E2E e vitrine em transações separadas: um erro na vitrine não impede o E2E (revisão S1, A2).
  const e2e = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('salao-seed-e2e'))`);
    const [existing] = await tx.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.slug, E2E_SLUG)).limit(1);
    if (existing) return "mantido" as const;
    await buildRestaurant(tx, e2eSpec(now));
    return "criado" as const;
  });
  const vitrine = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('salao-seed'))`);
    await tx.execute(sql`set local statement_timeout = '120s'`);
    if ((await vitrineVersion(tx)) === SEED_VERSION) return "mantida" as const;
    await tx.delete(restaurants).where(eq(restaurants.slug, VITRINE_SLUG));
    const built = await buildRestaurant(tx, vitrineSpec(new Date(now.getTime() - 60 * DAY_MS)));
    const [run] = await tx
      .insert(simulationRuns)
      .values({ restaurantId: built.restaurantId, kind: "vitrine", seed: VITRINE_SIM.seed, version: SEED_VERSION, params: {} })
      .returning({ id: simulationRuns.id });
    if (history) await history(tx, { restaurantId: built.restaurantId, runId: run!.id, now });
    return "criada" as const;
  });
  return { vitrine, e2e };
}

type Globals = { __salaoSeed?: SeedStatus; __salaoSeeding?: Promise<void>; __salaoSeedFails?: number; __salaoSeedLastFail?: number };
const g = globalThis as typeof globalThis & Globals;

export function seedStatus(): SeedStatus {
  return g.__salaoSeed ?? { state: "rodando" };
}

export const SEED_MAX_RETRIES = 5;

/** Nova tentativa depois de falha: espera crescente (60 s, 120 s, 240 s…) e no máximo 5 tentativas (revisão S1, M1). */
export function canRetrySeed(nowMs = Date.now()): boolean {
  const fails = g.__salaoSeedFails ?? 0;
  if (fails === 0) return true;
  if (fails >= SEED_MAX_RETRIES) return false;
  return nowMs - (g.__salaoSeedLastFail ?? 0) >= 60_000 * 2 ** (fails - 1);
}

/** Dispara o seed sem bloquear (chamado depois das migrações no boot). */
export function startSeed(run: () => Promise<unknown>): Promise<void> {
  if (g.__salaoSeeding) return g.__salaoSeeding;
  g.__salaoSeed = { state: "rodando" };
  const started = Date.now();
  g.__salaoSeeding = run()
    .then((r) => {
      g.__salaoSeed = { state: "ok" };
      g.__salaoSeedFails = 0;
      log.info("seed ok", { area: "seed", ms: Date.now() - started, status: JSON.stringify(r) });
    })
    .catch((err: unknown) => {
      const reason = err instanceof Error ? err.message : String(err);
      g.__salaoSeed = { state: "falhou", reason: reason.slice(0, 200) };
      g.__salaoSeedFails = (g.__salaoSeedFails ?? 0) + 1;
      g.__salaoSeedLastFail = Date.now();
      // Só o tipo e o código do erro no log: a mensagem do Drizzle traz os parâmetros da consulta (revisão S1, A2).
      log.error("seed falhou", { area: "seed", err: safeErr(err) });
    })
    .finally(() => {
      g.__salaoSeeding = undefined;
    });
  return g.__salaoSeeding;
}

export function resetSeedStateForTests(): void {
  g.__salaoSeed = undefined;
  g.__salaoSeeding = undefined;
  g.__salaoSeedFails = undefined;
  g.__salaoSeedLastFail = undefined;
}
