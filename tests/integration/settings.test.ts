import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { benefitVersions, customers, idleSlots, invites, menuItems } from "@/src/db/schema";
import { addMenuItem, addSlot, setMenuItemActive, updateMenuItem, updateOffer, updateRestaurantInfo, updateSlot } from "@/src/modules/config/application/update-settings";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { loadContext } from "@/src/modules/salao/application/context";
import { assignArm } from "@/src/modules/salao/domain/experiment";
import { fixedClock } from "@/src/shared/clock";
import { createRestaurant, resetDb } from "./helpers/db";

const NOW = new Date("2026-11-23T16:00:00Z");
const rand = () => (n: number) => Math.floor(Math.random() * n);

describe("Configurações com versões (D120, D218)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("trocar a oferta do convite cria versão nova; convite já emitido mantém a oferta da emissão", async () => {
    const r = await createRestaurant();
    let c = crypto.randomUUID();
    while (assignArm(c, r.restaurantId) !== "convidavel") c = crypto.randomUUID();
    await getDb().insert(customers).values({ id: c });
    await doCheckin(getDb(), { restaurantId: r.restaurantId, customerId: c, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(NOW.toISOString()), randInt: rand() });
    const [inv] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    const oldVersion = inv!.benefitVersionId;

    const res = await updateOffer(getDb(), { restaurantId: r.restaurantId, role: "convite", slotId: r.slots.A!, offer: { kind: "doce_gratis", itemId: r.items.tiramisu! }, weeklyCap: 33, inviteText: "Volte {horario:" + r.slots.A + "} e aproveite {oferta}.", now: NOW });
    expect(res).toMatchObject({ ok: true });
    const vs = await getDb().select().from(benefitVersions).where(eq(benefitVersions.restaurantId, r.restaurantId));
    const convite = vs.filter((v) => v.weeklyCap !== null);
    expect(convite.map((v) => [v.version, v.supersededAt === null, v.weeklyCap])).toEqual(expect.arrayContaining([[1, false, 20], [2, true, 33]]));
    const [inv2] = await getDb().select().from(invites).where(eq(invites.customerId, c));
    expect(inv2!.benefitVersionId).toBe(oldVersion);
    const ctx = await loadContext(getDb(), r.restaurantId);
    expect(ctx!.convites[r.slots.A!]!.offer.params.itemId).toBe(r.items.tiramisu);
    expect(ctx!.convites[r.slots.A!]!.inviteText).toContain("{oferta}");
  });

  it("duas edições simultâneas da mesma oferta: uma só versão vigente (revisão da S2)", async () => {
    const r = await createRestaurant();
    const edit = (cap: number) => updateOffer(getDb(), { restaurantId: r.restaurantId, role: "convite", slotId: r.slots.A!, offer: { kind: "doce_gratis", itemId: r.items.tiramisu! }, weeklyCap: cap, inviteText: "", now: NOW });
    const res = await Promise.all([edit(11), edit(12), edit(13), edit(14)]);
    expect(res.every((x) => x.ok)).toBe(true);
    const vs = await getDb().select().from(benefitVersions).where(and(eq(benefitVersions.restaurantId, r.restaurantId), isNull(benefitVersions.supersededAt)));
    const convitesA = vs.filter((v) => v.weeklyCap !== null && [11, 12, 13, 14, 20].includes(v.weeklyCap));
    expect(convitesA).toHaveLength(1);
  });

  it("validação: desconto acima de 50% e item de categoria errada são recusados; texto com PII também", async () => {
    const r = await createRestaurant();
    expect(await updateOffer(getDb(), { restaurantId: r.restaurantId, role: "agora", offer: { kind: "desconto", itemId: r.items.bruschetta!, pct: 60 }, now: NOW })).toMatchObject({ ok: false, erro: "oferta" });
    expect(await updateOffer(getDb(), { restaurantId: r.restaurantId, role: "agora", offer: { kind: "doce_gratis", itemId: r.items.bruschetta! }, now: NOW })).toMatchObject({ ok: false, erro: "oferta" });
    expect(await updateOffer(getDb(), { restaurantId: r.restaurantId, role: "convite", slotId: r.slots.A!, offer: { kind: "doce_gratis", itemId: r.items.cannoli! }, weeklyCap: 10, inviteText: "Ligue 11 98888-7777", now: NOW })).toMatchObject({ ok: false, erro: "texto" });
    // Revisão S2 #31: texto cita um prato que não é o da nova oferta → aviso.
    expect(await updateOffer(getDb(), { restaurantId: r.restaurantId, role: "convite", slotId: r.slots.A!, offer: { kind: "doce_gratis", itemId: r.items.cannoli! }, weeklyCap: 10, inviteText: `Volte para o {prato:${r.items.tiramisu}}.`, now: NOW })).toMatchObject({ ok: true, warnings: expect.arrayContaining(["prato_fora_da_oferta"]) });
    expect(await updateOffer(getDb(), { restaurantId: r.restaurantId, role: "convite", slotId: r.slots.A!, offer: { kind: "doce_gratis", itemId: r.items.cannoli! }, weeklyCap: 10, inviteText: `Volte para o {prato:${r.items.cannoli}}.`, now: NOW })).toMatchObject({ ok: true, warnings: [] });
  });

  it("cardápio: não desativa item de versão vigente; editar e acrescentar; item inativo ainda descreve versões antigas", async () => {
    const r = await createRestaurant();
    expect(await setMenuItemActive(getDb(), { restaurantId: r.restaurantId, itemId: r.items.cannoli!, active: false, now: NOW })).toEqual({ ok: false, erro: "em_uso" });
    expect(await updateMenuItem(getDb(), { restaurantId: r.restaurantId, itemId: r.items.bruschetta!, name: "Bruschetta da casa", priceCents: 2800, category: "entrada", now: NOW })).toEqual({ ok: true });
    const add = await addMenuItem(getDb(), { restaurantId: r.restaurantId, name: "Cassata", priceCents: 2400, category: "sobremesa", now: NOW });
    expect(add.ok).toBe(true);
    await updateOffer(getDb(), { restaurantId: r.restaurantId, role: "convite", slotId: r.slots.A!, offer: { kind: "doce_gratis", itemId: add.ok ? add.itemId : "" }, weeklyCap: 20, inviteText: "", now: NOW });
    expect(await setMenuItemActive(getDb(), { restaurantId: r.restaurantId, itemId: r.items.cannoli!, active: false, now: NOW })).toEqual({ ok: true });
    const ctx = await loadContext(getDb(), r.restaurantId);
    expect(ctx!.menu.find((m) => m.id === r.items.cannoli)?.name).toBe("Cannoli");
    const [row] = await getDb().select().from(menuItems).where(eq(menuItems.id, r.items.cannoli!));
    expect(row!.active).toBe(false);
  });

  it("faixas: editar mantém o id; faixa nova ganha convite (código) e teto; desativar a última é recusado", async () => {
    const r = await createRestaurant();
    expect(await updateSlot(getDb(), { restaurantId: r.restaurantId, slotId: r.slots.A!, days: [1, 2], startMin: 900, endMin: 1020, intensity: "muito", extraTables: 6, now: NOW })).toEqual({ ok: true });
    const [s] = await getDb().select().from(idleSlots).where(eq(idleSlots.id, r.slots.A!));
    expect([s!.days, s!.endMin]).toEqual([[1, 2], 1020]);
    const n = await addSlot(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, days: [5], startMin: 900, endMin: 1080, intensity: "um_pouco", extraTables: 2, now: NOW, gateway: null });
    expect(n).toMatchObject({ ok: true });
    const conv = await getDb().select().from(benefitVersions).where(and(eq(benefitVersions.restaurantId, r.restaurantId), isNull(benefitVersions.supersededAt)));
    expect(conv.filter((v) => v.weeklyCap !== null).map((v) => v.weeklyCap).sort()).toEqual([20, 8]);
    expect(await updateSlot(getDb(), { restaurantId: r.restaurantId, slotId: r.slots.A!, days: [3], startMin: 600, endMin: 660, intensity: "muito", extraTables: 1, now: NOW })).toMatchObject({ ok: true });
  });

  it("restaurante: ticket, margem, funcionamento e textos; funcionamento que não cobre as faixas é recusado", async () => {
    const r = await createRestaurant();
    expect(await updateRestaurantInfo(getDb(), { restaurantId: r.restaurantId, name: "Cantina Nova", ticketCents: 9000, marginPct: 60, tables: 30, weeklyCustomers: 500, description: "Casa nova.", address: "Rua Fictícia, 1", opening: [{ days: [0, 1, 2, 3, 4, 5, 6], startMin: 0, endMin: 1440 }], now: NOW })).toEqual({ ok: true });
    expect(await updateRestaurantInfo(getDb(), { restaurantId: r.restaurantId, name: "Cantina Nova", ticketCents: null, marginPct: null, tables: 30, weeklyCustomers: null, description: null, address: null, opening: [{ days: [0], startMin: 600, endMin: 700 }], now: NOW })).toMatchObject({ ok: false, erro: "funcionamento" });
  });
});
