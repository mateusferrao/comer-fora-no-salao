import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { retryUntil } from "../shared/retry";
import { getDb, type Db } from "./client";
import { log } from "@/src/shared/log";

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export async function runMigrations(db: Db = getDb()): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

// Estado por processo (sobrevive ao hot reload do `next dev`).
type Globals = { __salaoMigrated?: boolean; __salaoMigrating?: Promise<void> };
const g = globalThis as typeof globalThis & Globals;

/**
 * Garante as migrações aplicadas neste processo: roda uma vez, compartilha a execução entre chamadas
 * simultâneas e, se falhar, deixa a próxima chamada tentar de novo (banco que voltou depois do boot).
 * O health usa isto: sem migrações aplicadas, responde 503.
 */
export function ensureMigrated(run: () => Promise<void> = () => runMigrations()): Promise<void> {
  if (g.__salaoMigrated) return Promise.resolve();
  g.__salaoMigrating ??= run()
    .then(() => {
      g.__salaoMigrated = true;
    })
    .finally(() => {
      g.__salaoMigrating = undefined;
    });
  return g.__salaoMigrating;
}

export function resetMigrationStateForTests(): void {
  g.__salaoMigrated = undefined;
  g.__salaoMigrating = undefined;
}

/**
 * Política do boot (planejamento S0 §6.3): tenta migrar por ~30 s com espera crescente.
 * Se não conseguir, registra o erro e segue — o health responde db:"down" e tenta de novo a cada consulta.
 */
export async function migrateOnBoot(): Promise<boolean> {
  const result = await retryUntil(() => ensureMigrated(), { totalMs: 30_000, initialDelayMs: 500, maxDelayMs: 4_000 });
  if (result.ok) {
    log.info("migrações aplicadas", { area: "db", attempts: result.attempts });
    return true;
  }
  const message = result.error instanceof Error ? result.error.message : String(result.error);
  log.error("migração falhou; seguindo com db down", { area: "db", attempts: result.attempts, reason: message });
  return false;
}
