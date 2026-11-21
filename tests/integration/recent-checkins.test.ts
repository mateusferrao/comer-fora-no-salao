import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { codes, customerContacts, customers, simulationRuns } from "@/src/db/schema";
import { fixedClock } from "@/src/shared/clock";
import { mulberry32 } from "@/src/shared/rng";
import { assignArm, type Arm } from "@/src/modules/salao/domain/experiment";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { getRecentCheckins } from "@/src/modules/analytics/application/recent-checkins";
import { createRestaurant, resetDb } from "./helpers/db";

const SEG_13 = new Date("2026-11-23T16:00:00Z"); // segunda 13h SP
const DOM_23 = new Date("2026-11-23T02:30:00Z"); // domingo 23h30 SP (dia anterior em SP)
const rand = () => {
  const r = mulberry32(7);
  return (n: number) => Math.floor(r() * n);
};

async function customer(restaurantId: string, arm: Arm, name: string | null, run: string | null = null) {
  for (;;) {
    const id = crypto.randomUUID();
    if (assignArm(id, restaurantId) === arm) {
      await getDb().insert(customers).values({ id, simulationRunId: run });
      if (name !== undefined) await getDb().insert(customerContacts).values({ customerId: id, name });
      return id;
    }
  }
}
const checkin = (restaurantId: string, customerId: string, at: Date) =>
  doCheckin(getDb(), { restaurantId, customerId, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(at.toISOString()), randInt: rand() });

describe("Últimos check-ins de hoje (D172)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("só o dia em SP, só o restaurante, sem o histórico gerado; controle marcado; nome mascarado; código validado", async () => {
    const r = await createRestaurant();
    const other = await createRestaurant();
    const ana = await customer(r.restaurantId, "convidavel", "Ana Souza");
    const hugo = await customer(r.restaurantId, "holdout", "Hugo Lima");
    const ontem = await customer(r.restaurantId, "convidavel", "Ivo Rocha");
    const [run] = await getDb().insert(simulationRuns).values({ restaurantId: r.restaurantId, kind: "vitrine", seed: 1, version: 1, params: {} }).returning({ id: simulationRuns.id });
    const sim = await customer(r.restaurantId, "convidavel", "Gerado Costa", run!.id);
    const fora = await customer(other.restaurantId, "convidavel", "Outra Pessoa");
    await checkin(r.restaurantId, ontem, DOM_23);
    const va = await checkin(r.restaurantId, ana, SEG_13);
    await checkin(r.restaurantId, hugo, new Date(SEG_13.getTime() + 60_000));
    await checkin(r.restaurantId, sim, SEG_13);
    await checkin(other.restaurantId, fora, SEG_13);
    await getDb().update(codes).set({ status: "validado", validatedAt: SEG_13 }).where(eq(codes.code, va.codes[0]!.code));

    const list = await getRecentCheckins(getDb(), r.restaurantId, new Date(SEG_13.getTime() + 5 * 60_000));
    expect(list.map((x) => x.name)).toEqual(["Hugo L.", "Ana S."]);
    expect(list[0]).toMatchObject({ controle: true, firstVisit: true, validated: false });
    expect(list[1]).toMatchObject({ controle: false, firstVisit: true, validated: true });
    expect(list[1]!.at).toBe(SEG_13.toISOString());
  });

  it("cliente que apagou os dados aparece como 'Cliente'", async () => {
    const r = await createRestaurant();
    const c = await customer(r.restaurantId, "convidavel", "Bia Alves");
    await checkin(r.restaurantId, c, SEG_13);
    await getDb().delete(customerContacts).where(eq(customerContacts.customerId, c));
    const [row] = await getRecentCheckins(getDb(), r.restaurantId, SEG_13);
    expect(row!.name).toBe("Cliente");
  });
});
