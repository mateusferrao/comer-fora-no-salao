/**
 * S4 (D152, revisão técnica B4): "Simular 30 dias" saiu do produto. As rodadas `botao` que já existiam em
 * restaurantes de donos são apagadas uma vez no boot (cascata exata pelo `simulation_run_id`).
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { simulationRuns } from "@/src/db/schema";
import { clearRun } from "./persist";

export async function clearButtonRuns(db: Db): Promise<number> {
  const runs = await db.select({ id: simulationRuns.id }).from(simulationRuns).where(eq(simulationRuns.kind, "botao"));
  for (const r of runs) await db.transaction((tx) => clearRun(tx, r.id));
  return runs.length;
}
