import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { checkins, customers, invites, owners, restaurants, simulationRuns } from "@/src/db/schema";
import { fixedClock } from "@/src/shared/clock";
import { mulberry32 } from "@/src/shared/rng";
import { assignArm, type Arm } from "@/src/modules/salao/domain/experiment";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { advanceInvite } from "@/src/modules/salao/application/advance-invite";
import { advanceRestaurantOneDay, pickReactivatedCustomer } from "@/src/modules/salao/application/evaluator-tools";
import { clearButtonRuns } from "@/src/modules/simulacao/application/clear-button-runs";
import { createRestaurant, resetDb } from "./helpers/db";

const rand = () => {
  const r = mulberry32(Math.floor(Math.random() * 1e9));
  return (n: number) => Math.floor(r() * n);
};
// Faixa A do restaurante de teste: Ter–Qui 15h–18h.
const SEG_13 = new Date("2026-11-23T16:00:00Z"); // segunda 13h SP (fora da faixa)
const SEG_13_05 = new Date("2026-11-23T16:05:00Z");
const QUA_16 = new Date("2026-11-25T19:00:00Z"); // quarta 16h SP (dentro)
const QUA_16_10 = new Date("2026-11-25T19:10:00Z");

async function customerWithArm(restaurantId: string, arm: Arm, simulationRunId: string | null = null): Promise<string> {
  for (;;) {
    const id = crypto.randomUUID();
    if (assignArm(id, restaurantId) === arm) {
      await getDb().insert(customers).values({ id, simulationRunId });
      return id;
    }
  }
}
const checkin = (restaurantId: string, customerId: string, at: Date) =>
  doCheckin(getDb(), { restaurantId, customerId, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(at.toISOString()), randInt: rand() });

async function ownerOf(restaurantId: string) {
  const [r] = await getDb().select({ ownerId: restaurants.ownerId }).from(restaurants).where(eq(restaurants.id, restaurantId));
  return r!.ownerId;
}

describe("Ferramentas do avaliador: Avançar 1 dia (D153; antes D140/D141 só no teste)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("dentro da faixa: avançar → volta no mesmo dia gera o código do convite; week_key mantido", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    const v1 = await checkin(r.restaurantId, c, QUA_16);
    expect(v1.invite?.liberatedToday).toBe(false);
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(await advanceRestaurantOneDay(getDb(), { ownerId: await ownerOf(r.restaurantId), restaurantId: r.restaurantId, now: QUA_16 })).toEqual({ ok: true, advanced: 1, liberatedToday: 0 });
    const [after] = await getDb().select().from(invites).where(eq(invites.id, inv!.id));
    expect(after).toMatchObject({ issuedDay: "2026-11-24", weekKey: inv!.weekKey, testValidDay: null });
    const v2 = await checkin(r.restaurantId, c, QUA_16_10);
    expect(v2.outcome).toBe("volta_com_convite");
    expect(v2.codes.map((x) => x.type)).toContain("convite");
  });

  it("fora da faixa: libera só hoje, com o rótulo neutro na volta", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    await checkin(r.restaurantId, c, SEG_13);
    expect(await advanceRestaurantOneDay(getDb(), { ownerId: await ownerOf(r.restaurantId), restaurantId: r.restaurantId, now: SEG_13 })).toEqual({ ok: true, advanced: 1, liberatedToday: 1 });
    const [after] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(after).toMatchObject({ issuedDay: "2026-11-22", weekKey: "2026-W48", testValidDay: "2026-11-23" });
    const ck = await getDb().select().from(checkins).where(eq(checkins.customerId, c));
    expect(ck.map((x) => x.daySp)).toEqual(["2026-11-22"]);
    const v2 = await checkin(r.restaurantId, c, SEG_13_05);
    expect(v2.outcome).toBe("volta_com_convite");
    expect(v2.invite?.liberatedToday).toBe(true);
  });

  it("restaurante de outro dono é recusado; sem convite de hoje → nada para avançar", async () => {
    const r = await createRestaurant();
    const [other] = await getDb().insert(owners).values({ kind: "teste" }).returning({ id: owners.id });
    expect(await advanceRestaurantOneDay(getDb(), { ownerId: other!.id, restaurantId: r.restaurantId, now: SEG_13 })).toEqual({ ok: false, erro: "nao_e_seu" });
    expect(await advanceRestaurantOneDay(getDb(), { ownerId: await ownerOf(r.restaurantId), restaurantId: r.restaurantId, now: SEG_13 })).toEqual({ ok: false, erro: "nada_para_avancar" });
  });

  it("cliente do histórico gerado nunca é avançado", async () => {
    const r = await createRestaurant();
    const [run] = await getDb().insert(simulationRuns).values({ restaurantId: r.restaurantId, kind: "vitrine", seed: 1, version: 1, params: {} }).returning({ id: simulationRuns.id });
    const c = await customerWithArm(r.restaurantId, "convidavel", run!.id);
    await checkin(r.restaurantId, c, SEG_13);
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(await advanceInvite(getDb(), { customerId: c, inviteId: inv!.id, now: SEG_13 })).toEqual({ ok: false, erro: "historico" });
    expect(await advanceRestaurantOneDay(getDb(), { ownerId: await ownerOf(r.restaurantId), restaurantId: r.restaurantId, now: SEG_13 })).toEqual({ ok: false, erro: "nada_para_avancar" });
  });

  it("convite emitido ontem SEM avançar não é liberado fora da faixa (revisão S3 #34: exige o marcador)", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    await checkin(r.restaurantId, c, new Date("2026-11-22T16:00:00Z"));
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(await advanceInvite(getDb(), { customerId: c, inviteId: inv!.id, now: SEG_13 })).toEqual({ ok: false, erro: "nao_se_aplica" });
    const [after] = await getDb().select().from(invites).where(eq(invites.id, inv!.id));
    expect(after!.testValidDay).toBeNull();
  });

  it("grupo de controle: o cliente não recebe 2º card nem motivo (D152)", async () => {
    const r = await createRestaurant();
    const h = await customerWithArm(r.restaurantId, "holdout");
    const v = await checkin(r.restaurantId, h, SEG_13);
    expect(v.invite).toBeNull();
    expect(Object.keys(v)).not.toContain("testNote");
  });
});

describe("rodadas antigas de 'Simular 30 dias' (S4, revisão técnica B4)", () => {
  beforeEach(resetDb);

  it("o boot apaga só as rodadas 'botao'", async () => {
    const r = await createRestaurant();
    await getDb().insert(simulationRuns).values({ restaurantId: r.restaurantId, kind: "botao", seed: 1, version: 1, params: {} });
    await getDb().insert(simulationRuns).values({ restaurantId: r.restaurantId, kind: "vitrine", seed: 2, version: 1, params: {} });
    expect(await clearButtonRuns(getDb())).toBe(1);
    const left = await getDb().select({ kind: simulationRuns.kind }).from(simulationRuns);
    expect(left.map((x) => x.kind)).toEqual(["vitrine"]);
    expect((await getDb().execute(sql`select 1`)) !== null).toBe(true);
  });
});

describe("Ferramentas do avaliador: Ver como cliente reativado (revisão S4–S6, segurança 1)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  async function reactivated(restaurantId: string, simulationRunId: string | null) {
    const c = await customerWithArm(restaurantId, "convidavel", simulationRunId);
    await checkin(restaurantId, c, QUA_16);
    await getDb().update(invites).set({ origin: "reativacao" }).where(eq(invites.customerId, c));
    return c;
  }

  it("nunca escolhe um cliente real, nem fora da cópia do exemplo; escolhe o cliente simulado da cópia", async () => {
    const r = await createRestaurant();
    const owner = await ownerOf(r.restaurantId);
    const real = await reactivated(r.restaurantId, null);
    expect(real).toBeTruthy();
    // Restaurante próprio (não é cópia): nada, mesmo com cliente simulado.
    const [run] = await getDb().insert(simulationRuns).values({ kind: "vitrine", restaurantId: r.restaurantId, seed: 1, version: 1, params: {} }).returning({ id: simulationRuns.id });
    await reactivated(r.restaurantId, run!.id);
    expect(await pickReactivatedCustomer(getDb(), { ownerId: owner, now: QUA_16 })).toBeNull();
    // Cópia do exemplo: só o simulado; o real (mais recente) fica de fora.
    await getDb().update(restaurants).set({ copiedFrom: r.restaurantId }).where(eq(restaurants.id, r.restaurantId));
    const sim = await customerWithArm(r.restaurantId, "convidavel", run!.id);
    await checkin(r.restaurantId, sim, QUA_16);
    await getDb().update(invites).set({ origin: "reativacao" }).where(eq(invites.customerId, sim));
    const late = await reactivated(r.restaurantId, null);
    await getDb().update(invites).set({ issuedAt: new Date("2026-11-26T12:00:00Z") }).where(eq(invites.customerId, late));
    const picked = await pickReactivatedCustomer(getDb(), { ownerId: owner, now: QUA_16 });
    expect(picked).not.toBeNull();
    expect([real, late]).not.toContain(picked);
    const [c] = await getDb().select({ run: customers.simulationRunId }).from(customers).where(eq(customers.id, picked!));
    expect(c!.run).toBe(run!.id);
  });
});
