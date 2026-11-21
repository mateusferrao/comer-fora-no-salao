import type { Db } from "./client";

/** Banco ou transação (as duas têm a mesma API de consulta no Drizzle). */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;
