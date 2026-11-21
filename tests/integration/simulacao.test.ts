import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { checkins, customers, inviteQuota, invites, restaurants, simulationRuns, weeklyPlans } from "@/src/db/schema";
import { fixedClock } from "@/src/shared/clock";
import { seedAll } from "@/src/db/seed";
import { vitrineHistory } from "@/src/db/seed/history";
import { VITRINE_SLUG } from "@/src/db/seed/vitrine";
import { clearRun } from "@/src/modules/simulacao/application/persist";
import { planContentSchema, unknownReferences } from "@/src/modules/planos/domain/plan-content";
import { loadContext } from "@/src/modules/salao/application/context";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { simulate, VITRINE_SIM } from "@/src/modules/simulacao/domain/generator";
import { assignArm } from "@/src/modules/salao/domain/experiment";
import { addDaysSP } from "@/src/shared/week";
import { createRestaurant, resetDb } from "./helpers/db";

const NOW = "2026-11-23T15:00:00Z"; // segunda 12h SP

describe("vitrine com 60 dias simulados (Postgres real)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("seed completo em < 15 s, planos válidos e teto coerente (fantasma não consome)", async () => {
    const t0 = Date.now();
    await seedAll(getDb(), fixedClock(NOW), vitrineHistory);
    expect(Date.now() - t0).toBeLessThan(15_000);
    const [v] = await getDb().select().from(restaurants).where(eq(restaurants.slug, VITRINE_SLUG));
    const [ck] = await getDb().select({ n: count() }).from(checkins).where(eq(checkins.restaurantId, v!.id));
    expect(ck!.n).toBeGreaterThan(2000);
    const plans = await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.restaurantId, v!.id));
    expect(plans.map((p) => p.status).sort()).toEqual(["aprovado", "proposto"]);
    const ctx = (await loadContext(getDb(), v!.id))!;
    for (const p of plans) {
      const content = planContentSchema.parse({ version: 1, facts: p.facts, candidates: p.candidates, choices: p.choices, order: (p.texts as { order: string[] }).order, learned: p.learned, generatedBy: "fixo" });
      expect(unknownReferences(content, new Set(ctx.menu.map((m) => m.id)), new Set(ctx.slots.map((s) => s.id)))).toEqual([]);
    }
    // A oferta vigente da faixa B é a do plano anterior (Arancini).
    expect(ctx.menu.find((m) => m.id === ctx.convites[ctx.slots[1]!.id]!.offer.params.itemId)!.name).toBe("Arancini");
    const quotas = await getDb().select().from(inviteQuota).where(eq(inviteQuota.restaurantId, v!.id));
    for (const q of quotas) {
      const [row] = await getDb()
        .select({ n: count() })
        .from(invites)
        .where(and(eq(invites.restaurantId, v!.id), eq(invites.slotId, q.slotId), eq(invites.weekKey, q.weekKey), eq(invites.arm, "convidavel")));
      expect(q.used).toBe(row!.n);
      expect(q.used).toBeLessThanOrEqual(q.cap);
    }
    const ghosts = await getDb().select().from(invites).where(and(eq(invites.restaurantId, v!.id), eq(invites.arm, "holdout")));
    expect(ghosts.every((g) => g.status === "suprimido" || g.status === "expirado")).toBe(true);
  });

  it("na vitrine semeada, a 1ª visita de um convidável recebe o convite (2º card) — revisão S1", async () => {
    await seedAll(getDb(), fixedClock(NOW), vitrineHistory);
    const [v] = await getDb().select().from(restaurants).where(eq(restaurants.slug, VITRINE_SLUG));
    let id = "";
    do id = crypto.randomUUID();
    while (assignArm(id, v!.id) !== "convidavel");
    await getDb().insert(customers).values({ id });
    // Segunda 23/11 17h10 em SP (horário da demo).
    const view = await doCheckin(getDb(), { restaurantId: v!.id, customerId: id, gpsStatus: "confirmado_manual", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock("2026-11-23T20:10:00Z"), randInt: (n) => Math.floor(Math.random() * n) });
    expect(view.outcome).toBe("primeira_visita");
    expect(view.invite).toMatchObject({ state: "novo", days: [2, 3, 4], startMin: 900, endMin: 1080 });
    expect(view.invite!.offer).toMatchObject({ itemName: "Cannoli" });
  });

  it("clearRun remove só a rodada e reconta o teto", async () => {
    const r = await createRestaurant();
    const ctx = (await loadContext(getDb(), r.restaurantId))!;
    const slot = ctx.slots[0]!;
    // 1 convite real "de verdade" (fora da simulação) na semana corrente.
    const c = (await getDb().insert(customers).values({}).returning())[0]!;
    await doCheckin(getDb(), { restaurantId: r.restaurantId, customerId: c.id, gpsStatus: "perto", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(NOW), randInt: () => 3 });
    const realBefore = await getDb().select().from(invites);
    const [run] = await getDb().insert(simulationRuns).values({ restaurantId: r.restaurantId, kind: "botao", seed: 1, version: 1, params: {} }).returning();
    const startDay = addDaysSP("2026-11-23", -30);
    const out = simulate(
      {
        id: r.restaurantId,
        slots: ctx.slots,
        agora: { versionId: ctx.agora!.versionId, itemId: ctx.agora!.offer.params.itemId },
        recompensa: { versionId: ctx.recompensa!.versionId, itemId: ctx.recompensa!.offer.params.itemId },
        convites: [{ slotId: slot.id, versionId: ctx.convites[slot.id]!.versionId, itemId: ctx.convites[slot.id]!.offer.params.itemId, unitCostCents: 500, cap: 20, fromDay: startDay, toDay: null }],
        variantTokens: [],
      },
      { ...VITRINE_SIM, weeklyNew: 30, days: 30, startDay },
    );
    const { persistSimulation } = await import("@/src/modules/simulacao/application/persist");
    await getDb().transaction((tx) => persistSimulation(tx, { restaurantId: r.restaurantId, runId: run!.id, out, planIdBySendKey: {}, now: new Date(NOW) }));
    expect((await getDb().select().from(customers)).length).toBe(1 + out.customers.length);
    await getDb().transaction((tx) => clearRun(tx, run!.id));
    expect(await getDb().select().from(customers)).toHaveLength(1);
    expect(await getDb().select().from(invites)).toEqual(realBefore);
    const quotas = await getDb().select().from(inviteQuota);
    for (const q of quotas) expect(q.used).toBe(realBefore.filter((i) => i.weekKey === q.weekKey && i.slotId === q.slotId && i.arm === "convidavel").length);
  });

  it("diferencial: a mesma sequência passada por doCheckin no banco gera as mesmas decisões (T-I6)", async () => {
    const r = await createRestaurant({ slots: [{ key: "A", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 5, convite: { kind: "doce_gratis", item: "cannoli" }, weeklyCap: 8 }] });
    const ctx = (await loadContext(getDb(), r.restaurantId))!;
    const slot = ctx.slots[0]!;
    const startDay = "2026-10-20";
    const out = simulate(
      {
        id: r.restaurantId,
        slots: ctx.slots,
        agora: { versionId: ctx.agora!.versionId, itemId: ctx.agora!.offer.params.itemId },
        recompensa: { versionId: ctx.recompensa!.versionId, itemId: ctx.recompensa!.offer.params.itemId },
        convites: [{ slotId: slot.id, versionId: ctx.convites[slot.id]!.versionId, itemId: "x", unitCostCents: 0, cap: 8, fromDay: startDay, toDay: null }],
        variantTokens: [],
      },
      // Sem validação de códigos: no banco ninguém valida, então o estado tem de evoluir igual.
      { ...VITRINE_SIM, weeklyNew: 25, days: 28, startDay, validationP: 0, validationPSatNight: 0, baseVisits14: 1.2 },
    );
    for (const c of out.customers) await getDb().insert(customers).values({ id: c.id });
    for (const ck of out.checkins) {
      const v = await doCheckin(getDb(), { restaurantId: r.restaurantId, customerId: ck.customerId, gpsStatus: "perto", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(ck.at.toISOString()), randInt: (n) => Math.floor(Math.random() * n) });
      expect(v.outcome).toBe(ck.outcome);
    }
    const simKinds = out.invites.map((i) => `${i.customerId}:${i.arm}:${i.issuedDay}`).sort();
    const dbRows = await getDb().select().from(invites).where(eq(invites.restaurantId, r.restaurantId));
    expect(dbRows.map((i) => `${i.customerId}:${i.arm}:${i.issuedDay}`).sort()).toEqual(simKinds);
    expect(out.checkins.length).toBeGreaterThan(80);
  });
});

