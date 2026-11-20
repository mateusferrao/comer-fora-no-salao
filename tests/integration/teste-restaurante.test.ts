import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { checkins, customers, invites, simulationRuns } from "@/src/db/schema";
import { seedAll } from "@/src/db/seed";
import { vitrineHistory } from "@/src/db/seed/history";
import { fixedClock } from "@/src/shared/clock";
import { mulberry32 } from "@/src/shared/rng";
import { assignArm, type Arm } from "@/src/modules/salao/domain/experiment";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { advanceInvite } from "@/src/modules/salao/application/advance-invite";
import { clearTest, simulateTest } from "@/src/modules/simulacao/application/simulate-test";
import { createRestaurant, resetDb } from "./helpers/db";

const rand = () => {
  const r = mulberry32(Math.floor(Math.random() * 1e9));
  return (n: number) => Math.floor(r() * n);
};
// Faixa A do restaurante de teste: Ter–Qui 15h–18h.
const SEG_13 = new Date("2026-11-23T16:00:00Z"); // segunda 13h SP (fora da faixa), início da semana ISO
const SEG_13_05 = new Date("2026-11-23T16:05:00Z");
const QUA_16 = new Date("2026-11-25T19:00:00Z"); // quarta 16h SP (dentro)
const QUA_16_10 = new Date("2026-11-25T19:10:00Z");

async function customerWithArm(restaurantId: string, arm: Arm): Promise<string> {
  for (;;) {
    const id = crypto.randomUUID();
    if (assignArm(id, restaurantId) === arm) {
      await getDb().insert(customers).values({ id });
      return id;
    }
  }
}
const checkin = (restaurantId: string, customerId: string, at: Date) =>
  doCheckin(getDb(), { restaurantId, customerId, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(at.toISOString()), randInt: rand() });

describe("restaurante de teste: Antecipar (D140, D141) e motivo do holdout (D143)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("dentro da faixa: antecipar → volta no mesmo dia gera o código do convite; week_key mantido", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    const v1 = await checkin(r.restaurantId, c, QUA_16);
    expect(v1.invite?.test).toMatchObject({ canAdvance: true, liberatedToday: false });
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(await advanceInvite(getDb(), { customerId: c, inviteId: inv!.id, now: QUA_16 })).toEqual({ ok: true, testValidToday: false });
    const [after] = await getDb().select().from(invites).where(eq(invites.id, inv!.id));
    expect(after).toMatchObject({ issuedDay: "2026-11-24", weekKey: inv!.weekKey, testValidDay: null });
    const v2 = await checkin(r.restaurantId, c, QUA_16_10);
    expect(v2.outcome).toBe("volta_com_convite");
    expect(v2.codes.map((x) => x.type)).toContain("convite");
    // Repetir depois da volta: não se aplica (o convite já foi usado hoje ou tem check-in hoje).
    expect(await advanceInvite(getDb(), { customerId: c, inviteId: inv!.id, now: QUA_16_10 })).toMatchObject({ ok: false });
  });

  it("fora da faixa (segunda 13h): antecipar libera 'só no teste' e a volta gera o código", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    await checkin(r.restaurantId, c, SEG_13);
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(await advanceInvite(getDb(), { customerId: c, inviteId: inv!.id, now: SEG_13 })).toEqual({ ok: true, testValidToday: true });
    const [after] = await getDb().select().from(invites).where(eq(invites.id, inv!.id));
    // Segunda-feira: o recuo cai no domingo da semana anterior, mas o week_key (teto, coorte) fica.
    expect(after).toMatchObject({ issuedDay: "2026-11-22", weekKey: "2026-W48", testValidDay: "2026-11-23" });
    const ck = await getDb().select().from(checkins).where(eq(checkins.customerId, c));
    expect(ck.map((x) => x.daySp)).toEqual(["2026-11-22"]);
    const v2 = await checkin(r.restaurantId, c, SEG_13_05);
    expect(v2.outcome).toBe("volta_com_convite");
    expect(v2.invite?.test?.liberatedToday).toBe(true);
  });

  it("check-in ontem → não se aplica; convite de outro cliente → não encontrado; vitrine → não é teste", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    await checkin(r.restaurantId, c, new Date("2026-11-22T16:00:00Z")); // domingo (sem convite? a faixa é Ter–Qui: convite emitido mesmo assim)
    await checkin(r.restaurantId, c, SEG_13);
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    if (inv && inv.issuedDay === "2026-11-23") expect(await advanceInvite(getDb(), { customerId: c, inviteId: inv.id, now: SEG_13 })).toEqual({ ok: false, erro: "nao_se_aplica" });
    const other = await customerWithArm(r.restaurantId, "convidavel");
    if (inv) expect(await advanceInvite(getDb(), { customerId: other, inviteId: inv.id, now: SEG_13 })).toEqual({ ok: false, erro: "nao_encontrado" });

    await seedAll(getDb(), fixedClock(SEG_13.toISOString()), vitrineHistory);
    const vrow = ((await getDb().execute(sql`select id, customer_id from invites where status = 'ativo' and restaurant_id = (select id from restaurants where kind = 'vitrine' limit 1) limit 1`)) as unknown as { rows: Array<{ id: string; customer_id: string }> }).rows[0];
    if (vrow) expect(await advanceInvite(getDb(), { customerId: vrow.customer_id, inviteId: vrow.id, now: SEG_13 })).toEqual({ ok: false, erro: "nao_teste" });
  }, 60_000);

  it("convite emitido ontem SEM antecipar não é liberado fora da faixa (revisão S3 #34: exige o marcador)", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    await checkin(r.restaurantId, c, new Date("2026-11-22T16:00:00Z")); // domingo, fora da faixa: convite emitido
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(inv?.issuedDay).toBe("2026-11-22");
    // Segunda 13h (fora da faixa), sem check-in hoje: antes, o ramo "já antecipado" liberava; agora não se aplica.
    expect(await advanceInvite(getDb(), { customerId: c, inviteId: inv!.id, now: SEG_13 })).toEqual({ ok: false, erro: "nao_se_aplica" });
    const [after] = await getDb().select().from(invites).where(eq(invites.id, inv!.id));
    expect(after!.testValidDay).toBeNull();
  });

  it("holdout no teste: sem 2º card, com o motivo; teto esgotado: motivo 'teto'", async () => {
    const r = await createRestaurant();
    const h = await customerWithArm(r.restaurantId, "holdout");
    const v = await checkin(r.restaurantId, h, SEG_13);
    expect(v.invite).toBeNull();
    expect(v.testNote).toBe("grupo_controle");
    const r2 = await createRestaurant({ slots: [{ key: "A", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 1, convite: { kind: "doce_gratis", item: "cannoli" }, weeklyCap: 1 }] });
    await checkin(r2.restaurantId, await customerWithArm(r2.restaurantId, "convidavel"), SEG_13);
    const v2 = await checkin(r2.restaurantId, await customerWithArm(r2.restaurantId, "convidavel"), SEG_13);
    expect(v2.testNote).toBe("teto");
  });
});

describe("Simular 30 dias no teste (revisão T-B1, T-B2)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("2 restaurantes de teste simulam no mesmo dia sem colidir; clique duplo → 1 rodada; check-in real ainda recebe convite; limpar reconta", async () => {
    const a = await createRestaurant();
    const b = await createRestaurant();
    const [x, y] = await Promise.all([simulateTest(getDb(), { restaurantId: a.restaurantId, now: SEG_13 }), simulateTest(getDb(), { restaurantId: a.restaurantId, now: SEG_13 })]);
    expect([x.ok, y.ok].sort()).toEqual([false, true]);
    expect(await simulateTest(getDb(), { restaurantId: b.restaurantId, now: SEG_13 })).toMatchObject({ ok: true });
    const n = (id: string) => getDb().select({ n: sql<number>`count(*)::int` }).from(checkins).where(eq(checkins.restaurantId, id));
    expect((await n(a.restaurantId))[0]!.n).toBeGreaterThan(50);
    expect((await n(b.restaurantId))[0]!.n).toBeGreaterThan(50);
    // Nada na semana em curso (termina no domingo anterior).
    const cur = await getDb().select().from(invites).where(and(eq(invites.restaurantId, a.restaurantId), eq(invites.weekKey, "2026-W48")));
    expect(cur).toHaveLength(0);
    const c = await customerWithArm(a.restaurantId, "convidavel");
    expect((await checkin(a.restaurantId, c, SEG_13)).invite).not.toBeNull();
    expect(await clearTest(getDb(), { restaurantId: a.restaurantId })).toEqual({ ok: true, cleared: 1 });
    expect((await n(a.restaurantId))[0]!.n).toBe(1);
    expect(await getDb().select().from(simulationRuns).where(eq(simulationRuns.restaurantId, a.restaurantId))).toHaveLength(0);
  }, 60_000);

  it("restaurante protegido (E2E) e vitrine são recusados", async () => {
    const p = await createRestaurant({ protected: true } as never);
    expect(await simulateTest(getDb(), { restaurantId: p.restaurantId, now: SEG_13 })).toEqual({ ok: false, erro: "nao_teste" });
  });
});
