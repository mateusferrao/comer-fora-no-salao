import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { benefitVersions, checkins, codes, customerContacts, customers, inviteQuota, invites, restaurantCustomers, scans } from "@/src/db/schema";
import { adjustableClock, fixedClock } from "@/src/shared/clock";
import { mulberry32 } from "@/src/shared/rng";
import { assignArm, type Arm } from "@/src/modules/salao/domain/experiment";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { registerScan } from "@/src/modules/salao/application/register-scan";
import { createRestaurant, resetDb } from "./helpers/db";

const SEG_13 = "2026-11-23T16:00:00Z"; // segunda 13h SP (fora da faixa A Ter–Qui 15–18)
const TER_20 = "2026-11-24T23:00:00Z"; // terça 20h SP (fora)

const rand = () => {
  const r = mulberry32(Math.floor(Math.random() * 1e9));
  return (n: number) => Math.floor(r() * n);
};

async function customerWithArm(restaurantId: string, arm: Arm): Promise<string> {
  for (;;) {
    const id = crypto.randomUUID();
    if (assignArm(id, restaurantId) === arm) {
      await getDb().insert(customers).values({ id });
      return id;
    }
  }
}

function checkin(restaurantId: string, customerId: string, clock = fixedClock(SEG_13), key = crypto.randomUUID()) {
  return doCheckin(getDb(), { restaurantId, customerId, gpsStatus: "negado", variantId: null, idempotencyKey: key, clock, randInt: rand() });
}

describe("check-in (Postgres real)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("1ª visita de convidável: código, selo 1/6 e convite real congelado", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    const v = await checkin(r.restaurantId, c);
    expect(v.outcome).toBe("primeira_visita");
    expect(v.stamps).toBe(1);
    expect(v.codes).toHaveLength(1);
    expect(v.codes[0]).toMatchObject({ type: "primeira_visita", title: "Doce grátis", itemName: "Panna cotta" });
    expect(v.codes[0]!.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
    expect(v.invite).toMatchObject({ state: "novo", days: [2, 3, 4], startMin: 900, endMin: 1080, untilDay: "2026-12-23" });
    expect(v.invite!.offer).toMatchObject({ title: "Doce grátis", itemName: "Cannoli", gain: "Cannoli grátis" });
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(inv).toMatchObject({ arm: "convidavel", status: "ativo", issuedDay: "2026-11-23", weekKey: "2026-W48", origin: "mesa" });
    const [rc] = await getDb().select().from(restaurantCustomers).where(eq(restaurantCustomers.customerId, c));
    expect(rc).toMatchObject({ arm: "convidavel", firstVisitCodeIssued: true, cardStamps: 1, lastCheckinDay: "2026-11-23" });
    const [q] = await getDb().select().from(inviteQuota);
    expect(q).toMatchObject({ used: 1, cap: 20, weekKey: "2026-W48" });
  });

  it("holdout: fantasma gravado, nada visível e nenhum vazamento na resposta", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "holdout");
    const v = await checkin(r.restaurantId, c);
    expect(v.invite).toBeNull();
    const json = JSON.stringify(v);
    for (const word of ["holdout", "fantasma", "suprimido", "convite", "arm"]) expect(json).not.toContain(word);
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(inv).toMatchObject({ arm: "holdout", status: "suprimido" });
    const quota = await getDb().select().from(inviteQuota);
    expect(quota.every((q) => q.used === 0)).toBe(true);
  });

  it("clique duplo: 2 pedidos simultâneos com a mesma chave → resultados idênticos e 1 check-in", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    const key = crypto.randomUUID();
    const [a, b] = await Promise.all([checkin(r.restaurantId, c, fixedClock(SEG_13), key), checkin(r.restaurantId, c, fixedClock(SEG_13), key)]);
    expect(a).toEqual(b);
    expect(a.outcome).toBe("primeira_visita");
    expect(await getDb().select().from(checkins).where(eq(checkins.customerId, c))).toHaveLength(1);
  });

  it("recarregar (nova chave no mesmo dia) mostra de novo os códigos do dia e o convite", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    const first = await checkin(r.restaurantId, c);
    const again = await checkin(r.restaurantId, c, fixedClock("2026-11-23T22:00:00Z"));
    expect(again.outcome).toBe("ja_fez_checkin_hoje");
    expect(again.codes.map((x) => x.code)).toEqual(first.codes.map((x) => x.code));
    expect(again.invite).toMatchObject({ state: "novo" });
    expect(again.stamps).toBe(1);
  });

  it("corrida do teto: 2 convidáveis simultâneos com 1 vaga → 1 convite real", async () => {
    const r = await createRestaurant({ slots: [{ key: "A", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 1, convite: { kind: "doce_gratis", item: "cannoli" }, weeklyCap: 1 }] });
    const c1 = await customerWithArm(r.restaurantId, "convidavel");
    const c2 = await customerWithArm(r.restaurantId, "convidavel");
    const [v1, v2] = await Promise.all([checkin(r.restaurantId, c1), checkin(r.restaurantId, c2)]);
    expect([v1.invite, v2.invite].filter(Boolean)).toHaveLength(1);
    const real = await getDb().select().from(invites).where(eq(invites.arm, "convidavel"));
    expect(real).toHaveLength(1);
    const [q] = await getDb().select().from(inviteQuota);
    expect(q!.used).toBe(1);
    // Quem esbarrou no teto não entrou no sorteio: grupo continua vazio.
    const loser = real[0]!.customerId === c1 ? c2 : c1;
    const [rc] = await getDb().select().from(restaurantCustomers).where(eq(restaurantCustomers.customerId, loser));
    expect(rc!.arm).toBeNull();
  });

  it("volta na faixa em outro dia → código do convite; fora da faixa → lembrete", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    await checkin(r.restaurantId, c);
    const lembrete = await checkin(r.restaurantId, c, fixedClock(TER_20));
    expect(lembrete.outcome).toBe("volta_lembrete");
    expect(lembrete.invite).toMatchObject({ state: "lembrete" });
    const volta = await checkin(r.restaurantId, c, fixedClock("2026-11-25T19:10:00Z"));
    expect(volta.outcome).toBe("volta_com_convite");
    expect(volta.codes).toHaveLength(1);
    expect(volta.codes[0]).toMatchObject({ type: "convite", itemName: "Cannoli" });
    expect(volta.invite).toMatchObject({ state: "usar_hoje" });
    expect(volta.firstVisitAlreadyUsed).toBe(true);
    const [code] = await getDb().select().from(codes).where(and(eq(codes.customerId, c), eq(codes.type, "convite")));
    expect(code!.inviteId).not.toBeNull();
  });

  it("oferta congelada na emissão: nova versão da faixa não muda o convite já emitido (espec. 3.3)", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    await checkin(r.restaurantId, c);
    // O plano troca a oferta da faixa A: Cannoli → Tiramisù (versão 2).
    const [old] = await getDb().select().from(benefitVersions).where(eq(benefitVersions.id, r.versions.convites.A!));
    await getDb().update(benefitVersions).set({ supersededAt: new Date("2026-11-23T20:00:00Z") }).where(eq(benefitVersions.id, old!.id));
    await getDb().insert(benefitVersions).values({ ...old!, id: undefined, version: 2, params: { itemId: r.items.tiramisu }, supersededAt: null, validFrom: new Date("2026-11-23T20:00:00Z"), createdAt: undefined });
    const lembrete = await checkin(r.restaurantId, c, fixedClock(TER_20));
    expect(lembrete.invite!.offer).toMatchObject({ itemName: "Cannoli" });
    const volta = await checkin(r.restaurantId, c, fixedClock("2026-11-25T19:10:00Z"));
    expect(volta.codes[0]).toMatchObject({ type: "convite", title: "Doce grátis", itemName: "Cannoli" });
    expect(volta.invite!.offer).toMatchObject({ itemName: "Cannoli" });
    const [code] = await getDb().select().from(codes).where(and(eq(codes.customerId, c), eq(codes.type, "convite")));
    expect(code!.benefitVersionId).toBe(old!.id);
    expect(code!.itemId).toBe(r.items.cannoli);
  });

  it("convite vencido é marcado como expirado e um novo pode nascer", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    await checkin(r.restaurantId, c);
    const clock = adjustableClock("2026-12-24T16:00:00Z"); // 31 dias depois, quinta 13h
    const v = await checkin(r.restaurantId, c, clock);
    expect(v.invite).toMatchObject({ state: "novo", untilDay: "2027-01-23" });
    const rows = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(rows.map((x) => x.status).sort()).toEqual(["ativo", "expirado"]);
  });

  it("índice parcial barra um 2º convite ativo para o mesmo cliente", async () => {
    const r = await createRestaurant();
    const c = await customerWithArm(r.restaurantId, "convidavel");
    await checkin(r.restaurantId, c);
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    await expect(getDb().insert(invites).values({ ...inv!, id: undefined })).rejects.toThrow();
  });

  it("colisão de código: tenta de novo até achar um livre", async () => {
    const r = await createRestaurant();
    const c1 = await customerWithArm(r.restaurantId, "convidavel");
    const c2 = await customerWithArm(r.restaurantId, "convidavel");
    const zeros = () => 0; // sempre "AAAAAA"
    await doCheckin(getDb(), { restaurantId: r.restaurantId, customerId: c1, gpsStatus: "perto", variantId: null, idempotencyKey: "k1", clock: fixedClock(SEG_13), randInt: zeros });
    let calls = 0;
    const thenOther = (n: number) => (calls++ < 6 ? 0 : 1 % n);
    const v = await doCheckin(getDb(), { restaurantId: r.restaurantId, customerId: c2, gpsStatus: "perto", variantId: null, idempotencyKey: "k2", clock: fixedClock(SEG_13), randInt: thenOther });
    expect(v.codes[0]!.code).toBe("BBBBBB");
  });
});

describe("leituras (Postgres real)", () => {
  beforeEach(resetDb);

  // Identificação por telefone saiu na S4 (login por e-mail): coberta em customer-login.test.ts.

  it("leitura: 1 por aparelho e versão em 30 min; robô ignorado", async () => {
    const r = await createRestaurant({ pieces: [{ kind: "display", variants: [{ label: "A", token: "tok-a", texts: {} }] }] });
    const variantId = r.variants["tok-a"]!;
    const clock = adjustableClock(SEG_13);
    const ua = "Mozilla/5.0 (iPhone)";
    expect(await registerScan(getDb(), { restaurantId: r.restaurantId, variantId, deviceHash: "d1", userAgent: ua, clock })).toEqual({ counted: true });
    clock.advance(29 * 60_000);
    expect((await registerScan(getDb(), { restaurantId: r.restaurantId, variantId, deviceHash: "d1", userAgent: ua, clock })).counted).toBe(false);
    clock.advance(2 * 60_000);
    expect((await registerScan(getDb(), { restaurantId: r.restaurantId, variantId, deviceHash: "d1", userAgent: ua, clock })).counted).toBe(true);
    expect((await registerScan(getDb(), { restaurantId: r.restaurantId, variantId, deviceHash: "d2", userAgent: "WhatsApp/2.0", clock })).counted).toBe(false);
    expect(await getDb().select().from(scans)).toHaveLength(2);
  });
});
