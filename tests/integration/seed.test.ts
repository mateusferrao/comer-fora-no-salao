import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { restaurants, simulationRuns } from "@/src/db/schema";
import { fixedClock } from "@/src/shared/clock";
import { canRetrySeed, resetSeedStateForTests, seedAll, seedStatus, SEED_VERSION, startSeed } from "@/src/db/seed";
import { VITRINE_SLUG } from "@/src/db/seed/vitrine";
import { E2E_SLUG } from "@/src/db/seed/e2e";
import { loadContext } from "@/src/modules/salao/application/context";
import { validateOffer } from "@/src/modules/beneficios/domain/offers";
import { validateSlot } from "@/src/modules/beneficios/domain/slots";
import { resetDb } from "./helpers/db";

const clock = fixedClock("2026-11-20T15:00:00Z");

describe("seed (Postgres real)", () => {
  beforeEach(async () => {
    await resetDb();
    resetSeedStateForTests();
  });
  afterAll(closeDb);

  it("cria vitrine e restaurante E2E protegidos; 2ª execução mantém", async () => {
    expect(await seedAll(getDb(), clock)).toEqual({ vitrine: "criada", e2e: "criado" });
    expect(await seedAll(getDb(), clock)).toEqual({ vitrine: "mantida", e2e: "mantido" });
    const rows = await getDb().select().from(restaurants);
    expect(rows.map((r) => r.slug).sort()).toEqual([E2E_SLUG, VITRINE_SLUG].sort());
    expect(rows.every((r) => r.protected)).toBe(true);
  });

  it("2 seeds simultâneos não duplicam (advisory lock)", async () => {
    await Promise.all([seedAll(getDb(), clock), seedAll(getDb(), clock)]);
    expect(await getDb().select().from(restaurants)).toHaveLength(2);
  });

  it("versão nova recria a vitrine (e só ela)", async () => {
    await seedAll(getDb(), clock);
    const [e2eBefore] = await getDb().select().from(restaurants).where(eq(restaurants.slug, E2E_SLUG));
    await getDb().update(simulationRuns).set({ version: SEED_VERSION - 1 });
    expect((await seedAll(getDb(), clock)).vitrine).toBe("criada");
    const [e2eAfter] = await getDb().select().from(restaurants).where(eq(restaurants.slug, E2E_SLUG));
    expect(e2eAfter!.id).toBe(e2eBefore!.id);
  });

  it("conteúdo da vitrine é válido pelas próprias regras", async () => {
    await seedAll(getDb(), clock);
    const [v] = await getDb().select().from(restaurants).where(eq(restaurants.slug, VITRINE_SLUG));
    const ctx = (await loadContext(getDb(), v!.id))!;
    expect(ctx.menu).toHaveLength(20);
    for (const s of ctx.slots) expect(validateSlot(s, ctx.opening)).toEqual([]);
    for (const o of [ctx.agora!, ctx.recompensa!, ...Object.values(ctx.convites)]) expect(validateOffer(o.offer, ctx.menu)).toEqual([]);
    // Holdout: recado e descrição não citam ofertas nem horários do convite.
    for (const text of [v!.recado!, v!.description!]) {
      for (const banned of ["Cannoli", "Bruschetta", "15h", "18h", "21h", "23h", "convite"]) expect(text).not.toContain(banned);
    }
  });

  it("estado do seed: rodando → ok; erro → falhou com motivo", async () => {
    const p = startSeed(() => seedAll(getDb(), clock));
    expect(seedStatus().state).toBe("rodando");
    await p;
    expect(seedStatus()).toEqual({ state: "ok" });
    resetSeedStateForTests();
    await startSeed(() => Promise.reject(new Error("quebrou")));
    expect(seedStatus()).toEqual({ state: "falhou", reason: "quebrou" });
    // Nova tentativa só depois da espera (60 s na 1ª falha).
    expect(canRetrySeed(Date.now())).toBe(false);
    expect(canRetrySeed(Date.now() + 61_000)).toBe(true);
  });
});
