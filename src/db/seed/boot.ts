import { getSeedDb } from "@/src/db/client";
import { ensureMigrated } from "@/src/db/migrate";
import { clearButtonRuns } from "@/src/modules/simulacao/application/clear-button-runs";
import { systemClock } from "@/src/shared/clock";
import { canRetrySeed, seedAll, seedStatus, startSeed } from "./index";
import { vitrineHistory } from "./history";

/** Seed depois das migrações; se o banco estava fora no boot, o health tenta de novo (`ensureSeeded`). */
export function startSeedOnBoot(migrated: boolean): Promise<void> {
  if (!migrated) return Promise.resolve();
  return ensureSeeded();
}

export function ensureSeeded(): Promise<void> {
  return startSeed(async () => {
    await ensureMigrated();
    const r = await seedAll(getSeedDb(), systemClock, vitrineHistory);
    await clearButtonRuns(getSeedDb());
    return r;
  });
}

/** Chamado pelo health: tenta de novo só se não está rodando e a espera depois da última falha passou. */
export function retrySeedIfDue(): void {
  if (seedStatus().state === "ok") return;
  if (canRetrySeed()) void ensureSeeded();
}
