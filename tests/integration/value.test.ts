import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { codes, customerContacts, customers, simulationRuns } from "@/src/db/schema";
import { fixedClock } from "@/src/shared/clock";
import { mulberry32 } from "@/src/shared/rng";
import { assignArm, type Arm } from "@/src/modules/salao/domain/experiment";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { confirmCode } from "@/src/modules/salao/application/validate-code";
import { registerScan } from "@/src/modules/salao/application/register-scan";
import { getEarlyValue, getSlotGoals } from "@/src/modules/analytics/application/value";
import { getTodayFeed } from "@/src/modules/analytics/application/today-feed";
import { createRestaurant, resetDb } from "./helpers/db";

// Faixa A do restaurante de teste: Ter–Qui 15h–18h, convite = cannoli (R$ 22), teto 20.
const QUA_16 = new Date("2026-11-25T19:00:00Z"); // quarta 16h SP (dentro)
const QUI_16 = new Date("2026-11-26T19:00:00Z"); // quinta 16h SP (dentro, outro dia)
const rand = () => {
  const r = mulberry32(Math.floor(Math.random() * 1e9));
  return (n: number) => Math.floor(r() * n);
};

async function customer(restaurantId: string, arm: Arm, name: string, run: string | null = null) {
  for (;;) {
    const id = crypto.randomUUID();
    if (assignArm(id, restaurantId) === arm) {
      await getDb().insert(customers).values({ id, simulationRunId: run });
      await getDb().insert(customerContacts).values({ customerId: id, name });
      return id;
    }
  }
}
const checkin = (restaurantId: string, customerId: string, at: Date, variantId: string | null = null) =>
  doCheckin(getDb(), { restaurantId, customerId, gpsStatus: "negado", variantId, idempotencyKey: crypto.randomUUID(), clock: fixedClock(at.toISOString()), randInt: rand() });
const validate = (restaurantId: string, code: string, at: Date) => confirmCode(getDb(), { restaurantId, raw: code, idempotencyKey: crypto.randomUUID(), now: at });

describe("valor ao dono em R$, metas e 'Hoje no salão' (S5.1)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("convite usado = código de convite validado; custo pela versão da emissão; metas pela semana de validação", async () => {
    const r = await createRestaurant();
    const ana = await customer(r.restaurantId, "convidavel", "Ana Souza");
    const v1 = await checkin(r.restaurantId, ana, QUA_16);
    expect(v1.invite).not.toBeNull();
    expect(await getEarlyValue(getDb(), r.restaurantId)).toEqual({ usados: 0, custoCents: 0 });

    const v2 = await checkin(r.restaurantId, ana, QUI_16);
    const conv = v2.codes.find((c) => c.type === "convite")!;
    // Emitido e não validado: ainda não conta como usado.
    expect((await getEarlyValue(getDb(), r.restaurantId)).usados).toBe(0);
    expect((await validate(r.restaurantId, conv.code, QUI_16)).status).toBe("VALIDADO");
    const early = await getEarlyValue(getDb(), r.restaurantId);
    expect(early.usados).toBe(1);
    expect(early.custoCents).toBeGreaterThan(0);

    const goals = await getSlotGoals(getDb(), r.restaurantId, "2026-11-26");
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ slotId: r.slots.A, metaMesas: 5, usados: 1, emitidos: 1, teto: 20 });
    // Semana seguinte: nada usado ainda; teto de reserva pela regra vigente.
    expect((await getSlotGoals(getDb(), r.restaurantId, "2026-12-01"))[0]).toMatchObject({ usados: 0, emitidos: 0, teto: 20 });
  });

  it("o histórico gerado entra no valor (como a métrica principal, D162)", async () => {
    const r = await createRestaurant();
    const [run] = await getDb().insert(simulationRuns).values({ restaurantId: r.restaurantId, kind: "vitrine", seed: 1, version: 1, params: {} }).returning({ id: simulationRuns.id });
    const g = await customer(r.restaurantId, "convidavel", "Gerado Costa", run!.id);
    await checkin(r.restaurantId, g, QUA_16);
    const v2 = await checkin(r.restaurantId, g, QUI_16);
    await getDb().update(codes).set({ status: "validado", validatedAt: QUI_16 }).where(eq(codes.code, v2.codes.find((c) => c.type === "convite")!.code));
    expect((await getEarlyValue(getDb(), r.restaurantId)).usados).toBe(1);
  });

  it("feed do dia: leitura, check-in, convite emitido e código validado; só clientes reais; holdout marcado e sem linha de convite", async () => {
    const r = await createRestaurant({
      pieces: [{ kind: "display", variants: [{ label: "A", token: "tok-feed-a", texts: {} }] }],
    });
    const variant = r.variants["tok-feed-a"] ?? Object.values(r.variants)[0]!;
    await registerScan(getDb(), { restaurantId: r.restaurantId, variantId: variant, deviceHash: "dev-1", userAgent: "Mozilla/5.0", clock: fixedClock(new Date(QUA_16.getTime() - 60_000).toISOString()) });
    const ana = await customer(r.restaurantId, "convidavel", "Ana Souza");
    const hugo = await customer(r.restaurantId, "holdout", "Hugo Lima");
    const [run] = await getDb().insert(simulationRuns).values({ restaurantId: r.restaurantId, kind: "vitrine", seed: 1, version: 1, params: {} }).returning({ id: simulationRuns.id });
    const sim = await customer(r.restaurantId, "convidavel", "Gerado Costa", run!.id);
    const va = await checkin(r.restaurantId, ana, QUA_16, variant);
    await checkin(r.restaurantId, hugo, new Date(QUA_16.getTime() + 60_000));
    await checkin(r.restaurantId, sim, QUA_16);
    await validate(r.restaurantId, va.codes[0]!.code, new Date(QUA_16.getTime() + 120_000));

    const feed = await getTodayFeed(getDb(), r.restaurantId, new Date(QUA_16.getTime() + 5 * 60_000));
    expect(feed.counts).toEqual({ leituras: 1, checkins: 2, validados: 1 });
    expect(feed.items.map((i) => i.kind)).toEqual(["codigo", "checkin", "convite", "checkin", "leitura"]);
    const [codigo, hugoCk, convite, anaCk, leitura] = feed.items;
    expect(codigo).toMatchObject({ kind: "codigo", codeType: "primeira_visita", name: "Ana S." });
    expect(hugoCk).toMatchObject({ kind: "checkin", name: "Hugo L.", controle: true, outcome: "primeira_visita" });
    expect(convite).toMatchObject({ kind: "convite", name: "Ana S.", slot: { days: [2, 3, 4], startMin: 900, endMin: 1080 } });
    expect(anaCk).toMatchObject({ kind: "checkin", name: "Ana S.", controle: false });
    expect(leitura).toMatchObject({ kind: "leitura", piece: "Display mesa A" });
    expect(new Set(feed.items.map((i) => i.id)).size).toBe(feed.items.length);
    expect(JSON.stringify(feed)).not.toContain("Gerado");
    // Outro dia em SP: vazio.
    expect((await getTodayFeed(getDb(), r.restaurantId, new Date("2026-11-27T19:00:00Z"))).items).toEqual([]);
  });
});

describe("prova social da página do QR (S5.2, D181)", () => {
  beforeEach(resetDb);

  it("conta só check-ins reais dos últimos 7 dias, sem e-mails de teste nem o histórico gerado", async () => {
    const { recentCheckinCount } = await import("@/src/modules/salao/application/queries");
    const r = await createRestaurant();
    const ref = { id: r.restaurantId, slug: "cantina-real" };
    for (let i = 0; i < 4; i++) await checkin(r.restaurantId, await customer(r.restaurantId, "convidavel", `Pessoa ${i}`), QUA_16);
    expect(await recentCheckinCount(getDb(), ref, QUA_16)).toBe(4);
    // E-mail de teste (padrão D123) não conta.
    const t = await customer(r.restaurantId, "convidavel", "Teste");
    await getDb().update(customerContacts).set({ emailHint: "e•••@e•••.invalid" }).where(eq(customerContacts.customerId, t));
    await checkin(r.restaurantId, t, QUA_16);
    // Histórico gerado não conta.
    const [run] = await getDb().insert(simulationRuns).values({ restaurantId: r.restaurantId, kind: "vitrine", seed: 1, version: 1, params: {} }).returning({ id: simulationRuns.id });
    await checkin(r.restaurantId, await customer(r.restaurantId, "convidavel", "Gerado", run!.id), QUA_16);
    expect(await recentCheckinCount(getDb(), ref, QUA_16)).toBe(4);
    await checkin(r.restaurantId, await customer(r.restaurantId, "holdout", "Quinta Pessoa"), QUA_16);
    expect(await recentCheckinCount(getDb(), ref, QUA_16)).toBe(5);
    // 8 dias depois: fora da janela; restaurante E2E: sempre 0.
    expect(await recentCheckinCount(getDb(), ref, new Date(QUA_16.getTime() + 8 * 86_400_000))).toBe(0);
    expect(await recentCheckinCount(getDb(), { id: r.restaurantId, slug: "e2e-salao-teste" }, QUA_16)).toBe(0);
  });
});
