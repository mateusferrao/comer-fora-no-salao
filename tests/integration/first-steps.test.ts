import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { codes, customers, kitPieces } from "@/src/db/schema";
import { fixedClock } from "@/src/shared/clock";
import { mulberry32 } from "@/src/shared/rng";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { firstSteps } from "@/src/modules/onboarding/application/first-steps";
import { createRestaurant, resetDb } from "./helpers/db";

const SEG_13 = "2026-11-23T16:00:00Z";
const rand = () => {
  const r = mulberry32(3);
  return (n: number) => Math.floor(r() * n);
};

describe("Primeiros passos (S4 §4.4; revisão de produto I7)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("marca sozinho: kit no salão → 1º check-in → 1º código validado → 1º cliente voltou com convite", async () => {
    const r = await createRestaurant({ pieces: [{ kind: "display", variants: [{ label: "A", token: "tok-fs", texts: {} }] }] });
    await getDb().update(kitPieces).set({ inSalonAt: null }).where(eq(kitPieces.restaurantId, r.restaurantId));
    expect(await firstSteps(getDb(), r.restaurantId)).toEqual({ kitNoSalao: false, primeiroCheckin: false, primeiroCodigo: false, primeiraVolta: false });
    await getDb().update(kitPieces).set({ inSalonAt: new Date(SEG_13) }).where(eq(kitPieces.restaurantId, r.restaurantId));
    const [c] = await getDb().insert(customers).values({}).returning({ id: customers.id });
    const v = await doCheckin(getDb(), { restaurantId: r.restaurantId, customerId: c!.id, gpsStatus: "perto", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(SEG_13), randInt: rand() });
    expect(await firstSteps(getDb(), r.restaurantId)).toMatchObject({ kitNoSalao: true, primeiroCheckin: true, primeiroCodigo: false, primeiraVolta: false });
    await getDb().update(codes).set({ status: "validado", validatedAt: new Date(SEG_13) }).where(eq(codes.code, v.codes[0]!.code));
    expect(await firstSteps(getDb(), r.restaurantId)).toMatchObject({ primeiroCodigo: true, primeiraVolta: false });
    await getDb().insert(codes).values({ ...(await getDb().select().from(codes).where(eq(codes.code, v.codes[0]!.code)))[0]!, id: undefined, code: "ZZZZZZ", type: "convite", status: "emitido", validatedAt: null });
    expect((await firstSteps(getDb(), r.restaurantId)).primeiraVolta).toBe(true);
  });
});
