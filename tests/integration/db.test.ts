import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, getDb, pingDb } from "@/src/db/client";
import { runMigrations } from "@/src/db/migrate";
import { createHealthHandler } from "@/src/shared/health";

describe("banco e migrações (Postgres real)", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("roda as migrações duas vezes sem erro e cria a tabela restaurants", async () => {
    await runMigrations();
    await runMigrations();
    const rows = await getDb().execute<{ exists: boolean }>(
      sql`select to_regclass('public.restaurants') is not null as exists`,
    );
    expect(rows.rows[0]?.exists).toBe(true);
  });

  it("health com o banco real responde db up", async () => {
    const res = await createHealthHandler({ ping: pingDb, sha: "it" })();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "up", sha: "it" });
  });
});

describe("health exige migrações aplicadas", () => {
  it("com o banco no ar e migrações aplicadas → up", async () => {
    const { ensureMigrated, resetMigrationStateForTests } = await import("@/src/db/migrate");
    resetMigrationStateForTests();
    const res = await createHealthHandler({ ping: async () => {
      await pingDb();
      await ensureMigrated();
    }, sha: "it" })();
    expect(res.status).toBe(200);
  });
});
