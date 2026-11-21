import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureMigrated, resetMigrationStateForTests } from "@/src/db/migrate";

describe("ensureMigrated", () => {
  afterEach(() => resetMigrationStateForTests());

  it("roda uma vez e depois responde sem migrar de novo", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    await ensureMigrated(run);
    await ensureMigrated(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("chamadas simultâneas compartilham a mesma execução", async () => {
    let release!: () => void;
    const run = vi.fn(() => new Promise<void>((r) => (release = r)));
    const a = ensureMigrated(run);
    const b = ensureMigrated(run);
    release();
    await Promise.all([a, b]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("se falhar, a próxima chamada tenta de novo (banco que voltou)", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("sem banco")).mockResolvedValueOnce(undefined);
    await expect(ensureMigrated(run)).rejects.toThrow("sem banco");
    await expect(ensureMigrated(run)).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(2);
  });
});
