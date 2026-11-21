import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { customers, invites } from "@/src/db/schema";
import { fixedClock } from "@/src/shared/clock";
import { mulberry32 } from "@/src/shared/rng";
import { assignArm, type Arm } from "@/src/modules/salao/domain/experiment";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { agendaToken, inviteCalendar } from "@/src/modules/salao/application/agenda";
import { createRestaurant, resetDb } from "./helpers/db";

const QUA_16 = new Date("2026-11-25T19:00:00Z"); // quarta 16h SP, dentro da faixa Ter–Qui 15h–18h
const BASE = "https://exemplo.invalid";
const rand = () => {
  const r = mulberry32(3);
  return (n: number) => Math.floor(r() * n);
};
async function customer(restaurantId: string, arm: Arm) {
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

describe("Adicionar à agenda (S5.2)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("convite real: link assinado na tela; .ics na quinta (nunca no dia da emissão); vale hoje só na volta", async () => {
    const r = await createRestaurant();
    const c = await customer(r.restaurantId, "convidavel");
    const v = await checkin(r.restaurantId, c, QUA_16);
    expect(v.invite?.agendaUrl).toMatch(/^\/api\/convite\/agenda\?t=/);
    expect(v.invite?.validToday).toBe(false);
    const t = decodeURIComponent(v.invite!.agendaUrl!.split("t=")[1]!);
    const cal = await inviteCalendar(getDb(), { token: t, now: QUA_16, baseUrl: BASE });
    expect(cal?.body).toContain("DTSTART:20261126T180000Z");
    expect(cal?.body).toContain("SUMMARY:");
    expect(cal?.filename).toMatch(/^convite-.+\.ics$/);
    // Quinta 16h (volta dentro da faixa): o código nasce hoje.
    const back = await checkin(r.restaurantId, c, new Date("2026-11-26T19:00:00Z"));
    expect(back.outcome).toBe("volta_com_convite");
    expect(back.invite?.validToday).toBe(true);
  });

  it("token adulterado, convite do grupo de controle, usado ou vencido → null (a rota responde o mesmo 404)", async () => {
    const r = await createRestaurant();
    const h = await customer(r.restaurantId, "holdout");
    const vh = await checkin(r.restaurantId, h, QUA_16);
    expect(vh.invite).toBeNull();
    const [ghost] = await getDb().select().from(invites).where(eq(invites.customerId, h));
    expect(await inviteCalendar(getDb(), { token: agendaToken(ghost!.id), now: QUA_16, baseUrl: BASE })).toBeNull();
    expect(await inviteCalendar(getDb(), { token: `${agendaToken(ghost!.id)}x`, now: QUA_16, baseUrl: BASE })).toBeNull();
    expect(await inviteCalendar(getDb(), { token: "agenda:nada.assinatura", now: QUA_16, baseUrl: BASE })).toBeNull();

    const c = await customer(r.restaurantId, "convidavel");
    await checkin(r.restaurantId, c, QUA_16);
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(await inviteCalendar(getDb(), { token: agendaToken(inv!.id), now: new Date("2027-01-10T12:00:00Z"), baseUrl: BASE })).toBeNull();
    await getDb().update(invites).set({ status: "usado" }).where(eq(invites.id, inv!.id));
    expect(await inviteCalendar(getDb(), { token: agendaToken(inv!.id), now: QUA_16, baseUrl: BASE })).toBeNull();
  });
});
