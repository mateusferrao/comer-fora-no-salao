import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { customerContacts, customerMessages, customers, owners, restaurantCustomers, restaurants, weeklyDigests, weeklyPlans } from "@/src/db/schema";
import { seedAll } from "@/src/db/seed";
import { vitrineHistory } from "@/src/db/seed/history";
import { VITRINE_ID, VITRINE_OWNER_ID } from "@/src/db/seed/vitrine";
import { clearOutbox, memorySender, outbox } from "@/src/modules/contas/adapters/memory-sender";
import { runSchedulerTick, type TickDeps } from "@/src/modules/agendador/application/tick";
import { NOTIFY_DEFAULTS } from "@/src/modules/config/domain/notify-settings";
import { sendPendingInviteEmails } from "@/src/modules/salao/application/deliver-messages";
import { assignArm } from "@/src/modules/salao/domain/experiment";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { encryptEmail } from "@/src/shared/crypto";
import { fixedClock } from "@/src/shared/clock";
import { mulberry32 } from "@/src/shared/rng";
import { instantSP } from "@/src/shared/tz";
import { createRestaurant, resetDb } from "./helpers/db";

const at = (day: string, hhmm: string) => instantSP(day, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)));
const BASE = "https://app.exemplo";
let generated: string[] = [];
function deps(flags = { agendador: true, resumo_email: true }): TickDeps {
  return {
    sender: memorySender,
    baseUrl: BASE,
    flags,
    generatePlan: async ({ restaurantId, now }) => {
      generated.push(restaurantId);
      await getDb().insert(weeklyPlans).values({ restaurantId, weekKey: "2026-W48", status: "proposto", facts: {}, candidates: [], choices: [], texts: {}, learned: [], createdAt: now });
    },
    sendPending: (rid, ids) => sendPendingInviteEmails(getDb(), { restaurantId: rid, sender: memorySender, baseUrl: BASE, now: new Date(), inviteIds: ids }),
  };
}
const setSettings = (rid: string, s: object) => getDb().update(restaurants).set({ notifySettings: { ...NOTIFY_DEFAULTS, ...s } }).where(eq(restaurants.id, rid));
const toOwner = () => outbox().filter((m) => m.to === "dona@exemplo.com");

describe("agendador: plano e resumo no dia e hora do dono (S6.1, D187, D196)", () => {
  beforeEach(async () => {
    await resetDb();
    await seedAll(getDb(), fixedClock(at("2026-11-23", "08:00").toISOString()), vitrineHistory);
    await getDb().update(owners).set({ emailEnc: encryptEmail("dona@exemplo.com"), via: "email" }).where(eq(owners.id, VITRINE_OWNER_ID));
    clearOutbox();
    generated = [];
  });
  afterAll(closeDb);

  it("flag desligada → nada; sem e-mail do dono → nada", async () => {
    expect(await runSchedulerTick(getDb(), at("2026-11-23", "08:30"), deps({ agendador: false, resumo_email: true }))).toEqual({ planos: 0, resumos: { enviados: 0, falhas: 0 }, lembretes: 0 });
    await getDb().update(owners).set({ emailEnc: null }).where(eq(owners.id, VITRINE_OWNER_ID));
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "08:30"), deps())).resumos.enviados).toBe(0);
    expect(generated).toEqual([]);
  });

  it("proposta recente (de domingo) não é refeita; resumo às 08:30, 1 só por semana; recuperação até terça 08:29", async () => {
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "08:00"), deps())).planos).toBe(0);
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "08:29"), deps())).resumos.enviados).toBe(0);
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "08:30"), deps())).resumos.enviados).toBe(1);
    await Promise.all([runSchedulerTick(getDb(), at("2026-11-23", "08:31"), deps()), runSchedulerTick(getDb(), at("2026-11-23", "08:31"), deps())]);
    expect(toOwner()).toHaveLength(1);
    expect(toOwner()[0]!.subject).toContain("para aprovar"); // S9: com margem a mais certa, o valor vai no assunto
    const [w] = await getDb().select().from(weeklyDigests).where(eq(weeklyDigests.restaurantId, VITRINE_ID));
    expect(w).toMatchObject({ weekKey: "2026-W48", status: "enviado" });
  });

  it("recuperação: processo fora às 08:30 → sai terça 08:29; terça 08:30 já não sai", async () => {
    expect((await runSchedulerTick(getDb(), at("2026-11-24", "08:30"), deps())).resumos.enviados).toBe(0);
    expect((await runSchedulerTick(getDb(), at("2026-11-24", "08:29"), deps())).resumos.enviados).toBe(1);
  });

  it("sem proposta: gera a partir de T − 30 min; aprovação recente impede gerar de novo", async () => {
    await getDb().delete(weeklyPlans).where(and(eq(weeklyPlans.restaurantId, VITRINE_ID), eq(weeklyPlans.status, "proposto")));
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "07:59"), deps())).planos).toBe(0);
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "08:00"), deps())).planos).toBe(1);
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "08:10"), deps())).planos).toBe(0);
    await getDb().delete(weeklyPlans).where(and(eq(weeklyPlans.restaurantId, VITRINE_ID), eq(weeklyPlans.status, "proposto")));
    await getDb().insert(weeklyPlans).values({ restaurantId: VITRINE_ID, weekKey: "2026-W47", status: "aprovado", approvedAt: at("2026-11-21", "10:00"), facts: {}, candidates: [], choices: [], texts: {}, learned: [], createdAt: at("2026-11-21", "09:00") });
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "08:20"), deps())).planos).toBe(0);
  });

  it("aprovação no meio da semana anterior não pula a semana seguinte (âncora em T — revisão S4–S6, técnica A1)", async () => {
    await getDb().delete(weeklyPlans).where(and(eq(weeklyPlans.restaurantId, VITRINE_ID), eq(weeklyPlans.status, "proposto")));
    // Aprovado na quarta 18/11 (4 dias e 20 h antes da geração): a semana de 23/11 ganha plano novo.
    await getDb().insert(weeklyPlans).values({ restaurantId: VITRINE_ID, weekKey: "2026-W47", status: "aprovado", approvedAt: at("2026-11-18", "12:00"), facts: {}, candidates: [], choices: [], texts: {}, learned: [], createdAt: at("2026-11-18", "11:00") });
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "08:00"), deps())).planos).toBe(1);
    // Aprovado na terça 24/11, depois do T da semana: a segunda 30/11 também ganha plano novo.
    await getDb().delete(weeklyPlans).where(and(eq(weeklyPlans.restaurantId, VITRINE_ID), eq(weeklyPlans.status, "proposto")));
    await getDb().insert(weeklyPlans).values({ restaurantId: VITRINE_ID, weekKey: "2026-W48", status: "aprovado", approvedAt: at("2026-11-24", "09:00"), facts: {}, candidates: [], choices: [], texts: {}, learned: [], createdAt: at("2026-11-24", "08:50") });
    expect((await runSchedulerTick(getDb(), at("2026-11-30", "08:00"), deps())).planos).toBe(1);
  });

  it("no máximo 2 gerações por tique; o resto sai nos tiques seguintes; SIGTERM para entre restaurantes", async () => {
    await getDb().delete(weeklyPlans).where(and(eq(weeklyPlans.restaurantId, VITRINE_ID), eq(weeklyPlans.status, "proposto")));
    const extra = [await createRestaurant(), await createRestaurant()];
    for (const r of extra) {
      const [rr] = await getDb().select({ ownerId: restaurants.ownerId }).from(restaurants).where(eq(restaurants.id, r.restaurantId));
      await getDb().update(owners).set({ emailEnc: encryptEmail("outro@exemplo.com"), via: "email" }).where(eq(owners.id, rr!.ownerId));
    }
    expect(await runSchedulerTick(getDb(), at("2026-11-23", "08:00"), { ...deps(), stopped: () => true })).toEqual({ planos: 0, resumos: { enviados: 0, falhas: 0 }, lembretes: 0 });
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "08:00"), deps())).planos).toBe(2);
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "08:01"), deps())).planos).toBe(1);
    expect(new Set(generated).size).toBe(3);
  });

  it("resumo desligado: o plano automático continua (D196) e nenhum e-mail sai; plano automático desligado: resumo sem link", async () => {
    await getDb().delete(weeklyPlans).where(and(eq(weeklyPlans.restaurantId, VITRINE_ID), eq(weeklyPlans.status, "proposto")));
    await setSettings(VITRINE_ID, { resumo: { on: false, weekday: 1, minute: 510 } });
    const r = await runSchedulerTick(getDb(), at("2026-11-23", "08:30"), deps());
    expect(r.planos).toBe(1);
    expect(toOwner()).toHaveLength(0);
    await getDb().delete(weeklyPlans).where(and(eq(weeklyPlans.restaurantId, VITRINE_ID), eq(weeklyPlans.status, "proposto")));
    await setSettings(VITRINE_ID, { planoAuto: false });
    await runSchedulerTick(getDb(), at("2026-11-23", "08:35"), deps());
    expect(toOwner()[0]!.subject).not.toContain("para aprovar"); // S9: sem link de aprovar (o assunto pode trazer o valor)
  });

  it("dia e hora escolhidos: quarta 19:00", async () => {
    await setSettings(VITRINE_ID, { resumo: { on: true, weekday: 3, minute: 1140 } });
    expect((await runSchedulerTick(getDb(), at("2026-11-23", "08:30"), deps())).resumos.enviados).toBe(0);
    expect((await runSchedulerTick(getDb(), at("2026-11-25", "19:00"), deps())).resumos.enviados).toBe(1);
  });

  it("escopo de 1 restaurante (Ferramentas do avaliador): ignora o horário e só toca nele", async () => {
    const other = await createRestaurant();
    await getDb().update(owners).set({ emailEnc: encryptEmail("outra@exemplo.com"), via: "email" }).where(eq(owners.id, other.ownerId));
    const r = await runSchedulerTick(getDb(), at("2026-11-21", "15:00"), deps({ agendador: false, resumo_email: true }), { restaurantId: VITRINE_ID });
    expect(r.resumos.enviados).toBe(1);
    expect(outbox().some((m) => m.to === "outra@exemplo.com")).toBe(false);
  });
});

describe("lembrete do convite: 1 por convite, X h antes do 1º dia válido (S6.1, D189)", () => {
  // Faixa A: Ter–Qui 15h–18h. Check-in no sábado 21/11 → convite; 1º dia válido = terça 24/11.
  async function setup(opts: { email?: boolean } = {}) {
    const r = await createRestaurant();
    await getDb().update(owners).set({ via: "email" }).where(eq(owners.id, r.ownerId));
    let id = "";
    for (;;) {
      id = crypto.randomUUID();
      if (assignArm(id, r.restaurantId) === "convidavel") break;
    }
    await getDb().insert(customers).values({ id });
    await getDb().insert(customerContacts).values({ customerId: id, name: "Ana Souza", emailEnc: opts.email === false ? null : encryptEmail("ana@exemplo.com") });
    const rnd = mulberry32(7);
    const v = await doCheckin(getDb(), { restaurantId: r.restaurantId, customerId: id, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(at("2026-11-21", "13:00").toISOString()), randInt: (n) => Math.floor(rnd() * n) });
    expect(v.invite).not.toBeNull();
    clearOutbox();
    return { ...r, customerId: id };
  }
  const reminders = () => outbox().filter((m) => m.subject.includes("hoje vale seu convite"));

  it("terça 11:59 nada; 12:00 (3 h antes das 15h) 1 lembrete; outro tique não repete; quarta nada", async () => {
    await setup();
    expect((await runSchedulerTick(getDb(), at("2026-11-24", "11:59"), deps())).lembretes).toBe(0);
    expect((await runSchedulerTick(getDb(), at("2026-11-24", "12:00"), deps())).lembretes).toBe(1);
    expect((await runSchedulerTick(getDb(), at("2026-11-24", "12:30"), deps())).lembretes).toBe(0);
    expect((await runSchedulerTick(getDb(), at("2026-11-25", "12:00"), deps())).lembretes).toBe(0);
    expect(reminders()).toHaveLength(1);
    expect(reminders()[0]!.to).toBe("ana@exemplo.com");
    expect(reminders()[0]!.text).toContain("das 15h às 18h");
  });

  it("antecedência do dono (6 h → 09:00); dono desligou → sem e-mail, motivo gravado; cliente desligou lembretes → sem e-mail", async () => {
    const r = await setup();
    await setSettings(r.restaurantId, { lembreteHorasAntes: 6 });
    expect((await runSchedulerTick(getDb(), at("2026-11-24", "09:00"), deps())).lembretes).toBe(1);
    expect(reminders()).toHaveLength(1);

    const r2 = await setup();
    await setSettings(r2.restaurantId, { emails: { ...NOTIFY_DEFAULTS.emails, lembrete: false } });
    await runSchedulerTick(getDb(), at("2026-11-24", "12:00"), deps());
    const [m] = await getDb().select().from(customerMessages).where(and(eq(customerMessages.restaurantId, r2.restaurantId), eq(customerMessages.kind, "lembrete")));
    expect(m).toMatchObject({ emailStatus: "pulado", emailSkipReason: "dono_desligou" });

    const r3 = await setup();
    await getDb().update(restaurantCustomers).set({ emailPrefs: { convites: true, lembretes: false } }).where(eq(restaurantCustomers.customerId, r3.customerId));
    await runSchedulerTick(getDb(), at("2026-11-24", "12:00"), deps());
    const [m3] = await getDb().select().from(customerMessages).where(and(eq(customerMessages.restaurantId, r3.restaurantId), eq(customerMessages.kind, "lembrete")));
    expect(m3).toMatchObject({ emailStatus: "pulado", emailSkipReason: "cliente_desligou" });
    expect(reminders()).toHaveLength(0); // r2 e r3: nada saiu (o setup de cada um limpa a caixa)
  });
});
