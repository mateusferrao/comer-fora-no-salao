import { encryptEmail, encryptPhone } from "@/src/shared/crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { codes, customerContacts, customers, invites } from "@/src/db/schema";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { assignArm } from "@/src/modules/salao/domain/experiment";
import { confirmCode, lookupCode } from "@/src/modules/salao/application/validate-code";
import { adjustableClock, fixedClock } from "@/src/shared/clock";
import { createRestaurant, resetDb } from "./helpers/db";

const TER_16 = "2026-11-24T19:00:00Z"; // terça 16h SP (dentro da faixa A Ter–Qui 15–18)
const rand = () => (n: number) => Math.floor(Math.random() * n);

async function customer(restaurantId: string, name = "Ana Souza") {
  let id = crypto.randomUUID();
  while (assignArm(id, restaurantId) !== "convidavel") id = crypto.randomUUID();
  await getDb().insert(customers).values({ id });
  await getDb().insert(customerContacts).values({ customerId: id, phoneHmac: crypto.randomUUID(), phoneLast4: "4321", phoneEnc: encryptPhone("(11) 98765-4321"), emailEnc: encryptEmail("ana@exemplo.com"), name });
  return id;
}

describe("Validar código (garçom — espec. 3.3)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("1ª visita: consulta mostra tipo, contato completo do cliente (D237) e item; confirmar 2× com a mesma chave = 1 efeito", async () => {
    const r = await createRestaurant();
    const c = await customer(r.restaurantId);
    const ck = (await doCheckin(getDb(), { restaurantId: r.restaurantId, customerId: c, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(TER_16), randInt: rand() })) as { codes: Array<{ code: string; type: string }> };
    const code = ck.codes.find((x) => x.type === "primeira_visita")!.code;
    const now = new Date(TER_16);
    const l = await lookupCode(getDb(), { ownerId: r.ownerId, restaurantId: r.restaurantId, raw: ` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} `, now });
    expect(l).toMatchObject({ status: "OK", type: "primeira_visita", typeLabel: "1ª visita", customer: "Ana Souza", phone: "(11) 98765-4321", email: "ana@exemplo.com", item: "Panna cotta" });
    const key = crypto.randomUUID();
    const [a, b] = await Promise.all([confirmCode(getDb(), { restaurantId: r.restaurantId, raw: code, idempotencyKey: key, now }), confirmCode(getDb(), { restaurantId: r.restaurantId, raw: code, idempotencyKey: key, now })]);
    expect(a).toMatchObject({ status: "VALIDADO" });
    expect(b).toMatchObject({ status: "VALIDADO" });
    const [row] = await getDb().select().from(codes).where(eq(codes.code, code));
    expect(row!.status).toBe("validado");
    expect(await confirmCode(getDb(), { restaurantId: r.restaurantId, raw: code, idempotencyKey: crypto.randomUUID(), now })).toMatchObject({ status: "JA_USADO", validatedAt: "16:00" });
  });

  it("convite: na volta dentro da faixa → código do convite; confirmar marca o convite como usado; condições congeladas", async () => {
    const r = await createRestaurant();
    const c = await customer(r.restaurantId);
    const clock = adjustableClock("2026-11-23T16:00:00Z"); // segunda 13h: 1ª visita + convite
    await doCheckin(getDb(), { restaurantId: r.restaurantId, customerId: c, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock, randInt: rand() });
    clock.set(TER_16);
    const back = (await doCheckin(getDb(), { restaurantId: r.restaurantId, customerId: c, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock, randInt: rand() })) as { codes: Array<{ code: string; type: string }> };
    const code = back.codes.find((x) => x.type === "convite")!.code;
    const l = await lookupCode(getDb(), { ownerId: r.ownerId, restaurantId: r.restaurantId, raw: code, now: new Date(TER_16) });
    expect(l).toMatchObject({ status: "OK", typeLabel: "Convite", item: "Cannoli" });
    expect(l.status === "OK" && l.conditions).toBe("Convite · válido Ter, Qua, Qui · 15h–18h · até 23/12");
    await confirmCode(getDb(), { restaurantId: r.restaurantId, raw: code, idempotencyKey: crypto.randomUUID(), now: new Date(TER_16) });
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(inv!.status).toBe("usado");
  });

  it("inválido, expirado (dia seguinte) e de outro restaurante do mesmo dono; de outro dono = inválido", async () => {
    const r = await createRestaurant();
    const c = await customer(r.restaurantId);
    const ck = (await doCheckin(getDb(), { restaurantId: r.restaurantId, customerId: c, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(TER_16), randInt: rand() })) as { codes: Array<{ code: string }> };
    const code = ck.codes[0]!.code;
    expect(await lookupCode(getDb(), { ownerId: r.ownerId, restaurantId: r.restaurantId, raw: "ZZZZZZ", now: new Date(TER_16) })).toMatchObject({ status: "INVALIDO" });
    expect(await lookupCode(getDb(), { ownerId: r.ownerId, restaurantId: r.restaurantId, raw: "12", now: new Date(TER_16) })).toMatchObject({ status: "INVALIDO" });
    expect(await lookupCode(getDb(), { ownerId: r.ownerId, restaurantId: r.restaurantId, raw: code, now: new Date("2026-11-25T12:00:00Z") })).toMatchObject({ status: "EXPIRADO" });
    expect(await confirmCode(getDb(), { restaurantId: r.restaurantId, raw: code, idempotencyKey: "k", now: new Date("2026-11-25T12:00:00Z") })).toMatchObject({ status: "EXPIRADO" });
    // outro restaurante do mesmo dono
    const r2 = await createRestaurant({ owner: { id: r.ownerId, kind: "teste" } });
    expect(await lookupCode(getDb(), { ownerId: r.ownerId, restaurantId: r2.restaurantId, raw: code, now: new Date(TER_16) })).toMatchObject({ status: "OUTRO_RESTAURANTE" });
    // outro dono não descobre que o código existe
    const r3 = await createRestaurant();
    expect(await lookupCode(getDb(), { ownerId: r3.ownerId, restaurantId: r3.restaurantId, raw: code, now: new Date(TER_16) })).toMatchObject({ status: "INVALIDO" });
  });
});
