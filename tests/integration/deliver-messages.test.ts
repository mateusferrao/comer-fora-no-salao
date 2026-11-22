import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { customerContacts, customerMessages, customers, invites, restaurantCustomers } from "@/src/db/schema";
import { clearOutbox, memorySender, outbox } from "@/src/modules/contas/adapters/memory-sender";
import { assignArm, type Arm } from "@/src/modules/salao/domain/experiment";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { listCustomerMessages, markMessagesRead, sendPendingInviteEmails } from "@/src/modules/salao/application/deliver-messages";
import { encryptEmail, hmacCustomerEmail } from "@/src/shared/crypto";
import { fixedClock } from "@/src/shared/clock";
import { mulberry32 } from "@/src/shared/rng";
import { createRestaurant, resetDb } from "./helpers/db";

const SEG_13 = new Date("2026-11-23T16:00:00Z");
const BASE = "https://exemplo.invalid";
const rand = () => {
  const r = mulberry32(11);
  return (n: number) => Math.floor(r() * n);
};

async function realCustomer(restaurantId: string, arm: Arm, email: string | null, optEmail = true) {
  for (;;) {
    const id = crypto.randomUUID();
    if (assignArm(id, restaurantId) === arm) {
      await getDb().insert(customers).values({ id });
      await getDb().insert(customerContacts).values({ customerId: id, name: "Ana Souza", emailHmac: email ? hmacCustomerEmail(email) : null, emailEnc: email ? encryptEmail(email) : null });
      await getDb().insert(restaurantCustomers).values({ restaurantId, customerId: id, optEmail, optApp: true, optWhatsapp: false, optPush: false });
      return id;
    }
  }
}
const checkin = (restaurantId: string, customerId: string) =>
  doCheckin(getDb(), { restaurantId, customerId, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(SEG_13.toISOString()), randInt: rand() });

describe("convite entregue no app e por e-mail (S4.4 — D155, D163, D174, D175)", () => {
  beforeEach(async () => {
    await resetDb();
    clearOutbox();
  });
  afterAll(closeDb);

  it("convite nascido na mesa: mensagem no app + e-mail (depois do commit), sem link de terceiros e com descadastro", async () => {
    const r = await createRestaurant();
    const c = await realCustomer(r.restaurantId, "convidavel", "ana@exemplo.com");
    const v = await checkin(r.restaurantId, c);
    expect(v.invite).not.toBeNull();
    const msgs = await listCustomerMessages(getDb(), c);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ kind: "convite_mesa", unread: true });
    expect(outbox()).toHaveLength(0); // nada sai dentro do check-in
    const res = await sendPendingInviteEmails(getDb(), { restaurantId: r.restaurantId, sender: memorySender, baseUrl: BASE, now: SEG_13 });
    expect(res).toEqual({ sent: 1, skipped: 0, failed: 0 });
    const m = outbox().at(-1)!;
    expect(m.to).toBe("ana@exemplo.com");
    expect(m.text).toContain("Protótipo de case · não é produto oficial do iFood");
    expect(m.text).toContain(`${BASE}/app/jornada`);
    // S9: por que recebeu, validade com o 1º dia em que vale e link direto para o check-in.
    expect(m.text).toContain("Você fez check-in no restaurante Cantina de Teste em 23/11.");
    expect(m.text).toMatch(/Vale de 24\/11 até \d{2}\/\d{2}, só nesses dias e horários\./);
    expect(m.text).toMatch(new RegExp(`Fazer check-in: ${BASE}/r/t-`));
    expect(m.text).not.toContain("no app");
    expect(m.text).toMatch(new RegExp(`${BASE}/cliente/descadastrar\\?t=`));
    // Idempotente: rodar de novo não reenvia.
    expect(await sendPendingInviteEmails(getDb(), { restaurantId: r.restaurantId, sender: memorySender, baseUrl: BASE, now: SEG_13 })).toEqual({ sent: 0, skipped: 0, failed: 0 });
    await markMessagesRead(getDb(), c, SEG_13);
    expect((await listCustomerMessages(getDb(), c))[0]!.unread).toBe(false);
  });

  it("S5.2 (copy_v2): assunto novo, o quando primeiro e o link assinado da agenda", async () => {
    const r = await createRestaurant();
    const c = await realCustomer(r.restaurantId, "convidavel", "ana@exemplo.com");
    await checkin(r.restaurantId, c);
    await sendPendingInviteEmails(getDb(), { restaurantId: r.restaurantId, sender: memorySender, baseUrl: BASE, now: SEG_13, v2: true });
    const m = outbox().at(-1)!;
    expect(m.subject).toMatch(/^Terça, quarta e quinta, das 15h às 18h: .+ grátis no restaurante Cantina de Teste$/);
    expect(m.text.split("\n")[0]).toMatch(/^Volte terça, quarta e quinta, das 15h às 18h e ganhe .+\.$/);
    // S9: a 1ª linha não se repete no texto do convite.
    expect(m.text.match(/Volte terça, quarta e quinta/g)).toHaveLength(1);
    expect(m.text).toMatch(new RegExp(`Adicionar à agenda: ${BASE}/api/convite/agenda\\?t=`));
    expect(m.text).toContain("Protótipo de case · não é produto oficial do iFood");
  });

  it("sem consentimento de e-mail, endereço de teste ou sem e-mail: só no app", async () => {
    const r = await createRestaurant();
    const a = await realCustomer(r.restaurantId, "convidavel", "bia@exemplo.com", false);
    const b = await realCustomer(r.restaurantId, "convidavel", "e2e-cliente+1@exemplo.invalid");
    const c = await realCustomer(r.restaurantId, "convidavel", null);
    for (const x of [a, b, c]) await checkin(r.restaurantId, x);
    const res = await sendPendingInviteEmails(getDb(), { restaurantId: r.restaurantId, sender: memorySender, baseUrl: BASE, now: SEG_13 });
    expect(res.sent).toBe(0);
    expect(outbox()).toHaveLength(0);
    for (const x of [a, b, c]) expect(await listCustomerMessages(getDb(), x)).toHaveLength(1);
  });

  it("grupo de controle: nada no app, nada por e-mail", async () => {
    const r = await createRestaurant();
    const h = await realCustomer(r.restaurantId, "holdout", "hugo@exemplo.com");
    await checkin(r.restaurantId, h);
    expect(await listCustomerMessages(getDb(), h)).toHaveLength(0);
    expect((await sendPendingInviteEmails(getDb(), { restaurantId: r.restaurantId, sender: memorySender, baseUrl: BASE, now: SEG_13 })).sent).toBe(0);
  });

  it("texto do convite com link ou contato (D174): vai só para o app", async () => {
    const r = await createRestaurant();
    const c = await realCustomer(r.restaurantId, "convidavel", "ana@exemplo.com");
    await checkin(r.restaurantId, c);
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    const { benefitVersions } = await import("@/src/db/schema");
    await getDb().update(benefitVersions).set({ inviteText: "Volte e chame no zap (11) 91234-5678" }).where(eq(benefitVersions.id, inv!.benefitVersionId!));
    const res = await sendPendingInviteEmails(getDb(), { restaurantId: r.restaurantId, sender: memorySender, baseUrl: BASE, now: SEG_13 });
    expect(res).toEqual({ sent: 0, skipped: 1, failed: 0 });
    const [m] = await getDb().select().from(customerMessages).where(eq(customerMessages.customerId, c));
    expect(m!.emailStatus).toBe("pulado");
  });

  it("teto diário por restaurante", async () => {
    const r = await createRestaurant();
    for (let i = 0; i < 3; i++) await checkin(r.restaurantId, await realCustomer(r.restaurantId, "convidavel", `c${i}@exemplo.com`));
    const res = await sendPendingInviteEmails(getDb(), { restaurantId: r.restaurantId, sender: memorySender, baseUrl: BASE, now: SEG_13, limitPerDay: 2 });
    expect(res).toEqual({ sent: 2, skipped: 1, failed: 0 });
  });
});
