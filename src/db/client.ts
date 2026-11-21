import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { log } from "@/src/shared/log";

export type Db = NodePgDatabase<typeof schema>;

// Pool guardado em globalThis para sobreviver ao hot reload do `next dev`.
type Globals = { __salaoPool?: Pool; __salaoDb?: Db; __salaoSeedPool?: Pool; __salaoSeedDb?: Db };
const g = globalThis as typeof globalThis & Globals;

export function getPool(): Pool {
  if (!g.__salaoPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL não definida");
    g.__salaoPool = new Pool({
      connectionString,
      connectionTimeoutMillis: 2_000,
      // Banco travado não pode prender conexões do pool para sempre.
      query_timeout: 15_000,
      statement_timeout: 15_000,
      idleTimeoutMillis: 30_000,
      max: 10,
    });
    // Erro em conexão ociosa não pode derrubar o processo.
    g.__salaoPool.on("error", (err) => log.error("erro no pool", { area: "db", err: err.message }));
  }
  return g.__salaoPool;
}

export function getDb(): Db {
  if (!g.__salaoDb) g.__salaoDb = drizzle(getPool(), { schema });
  return g.__salaoDb;
}

/**
 * Pool só do seed da vitrine (1 conexão, limite de 120 s): o `query_timeout` de 15 s do pool principal
 * anularia o `SET LOCAL statement_timeout` da recriação em cascata (revisão S1, M1).
 */
export function getSeedDb(): Db {
  if (!g.__salaoSeedDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL não definida");
    g.__salaoSeedPool = new Pool({ connectionString, connectionTimeoutMillis: 5_000, query_timeout: 120_000, statement_timeout: 120_000, max: 1 });
    g.__salaoSeedPool.on("error", (err) => log.error("erro no pool do seed", { area: "db", err: err.message }));
    g.__salaoSeedDb = drizzle(g.__salaoSeedPool, { schema });
  }
  return g.__salaoSeedDb;
}

export async function pingDb(): Promise<void> {
  await getPool().query("select 1");
}

export async function closeDb(): Promise<void> {
  const pool = g.__salaoPool;
  g.__salaoPool = undefined;
  g.__salaoDb = undefined;
  await pool?.end();
}
