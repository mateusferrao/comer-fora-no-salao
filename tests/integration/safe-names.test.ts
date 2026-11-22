import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { menuItems, owners, restaurants } from "@/src/db/schema";
import { addMenuItem, updateMenuItem, updateRestaurantInfo } from "@/src/modules/config/application/update-settings";
import { createTestRestaurant } from "@/src/modules/onboarding/application/test-restaurants";
import { saveMenu, saveSalon } from "@/src/modules/onboarding/application/wizard";
import { EXAMPLES } from "@/src/modules/onboarding/adapters/example-source";
import { createRestaurant, resetDb } from "./helpers/db";

const NOW = new Date("2026-11-21T14:00:00Z");

/** S9 (segurança M1): nome do restaurante e do prato vão nos e-mails; com contato ou marca iFood, não gravam. */
describe("nomes que vão nos e-mails (S9 — M1)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  async function draft() {
    const [o] = await getDb().insert(owners).values({ kind: "teste", via: "email", emailHmac: "h1" }).returning({ id: owners.id });
    const c = await createTestRestaurant(getDb(), { ownerId: o!.id, ip: "1.1.1.1", now: NOW });
    if (!c.ok) throw new Error("criar");
    return c.restaurantId;
  }

  it("assistente: nome do restaurante com telefone é recusado e não grava", async () => {
    const id = await draft();
    const p = EXAMPLES.boteco.preset;
    const base = { tables: p.tables, weeklyCustomers: p.weeklyCustomers, opening: p.opening, slots: p.slots, ticketCents: p.ticketCents, marginPct: p.marginPct };
    expect(await saveSalon(getDb(), id, { ...base, name: "Suporte (11) 91234-5678" }, NOW)).toEqual({ ok: false, erro: "nome_contato" });
    const [r] = await getDb().select({ name: restaurants.name }).from(restaurants).where(eq(restaurants.id, id));
    expect(r!.name).toBe("Meu restaurante");
    expect((await saveSalon(getDb(), id, { ...base, name: "Bar do Zé" }, NOW)).ok).toBe(true);
  });

  it("assistente: cardápio com prato que cita site ou iFood é recusado inteiro", async () => {
    const id = await draft();
    const item = (nome: string) => ({ categoria: "prato" as const, nome, precoCentavos: 3000 });
    expect(await saveMenu(getDb(), id, { items: [item("Lasanha"), item("Promo em golpe.com")], cuisine: null, priceBand: null, extractionId: null }, NOW)).toEqual({ ok: false, erro: "item_contato" });
    expect(await saveMenu(getDb(), id, { items: [item("Lasanha"), item("Combo iFood")], cuisine: null, priceBand: null, extractionId: null }, NOW)).toEqual({ ok: false, erro: "item_marca" });
    expect(await getDb().select().from(menuItems).where(eq(menuItems.restaurantId, id))).toHaveLength(0);
    expect((await saveMenu(getDb(), id, { items: [item("Lasanha")], cuisine: null, priceBand: null, extractionId: null }, NOW)).ok).toBe(true);
  });

  it("configurações: nome do restaurante e do prato com contato são recusados", async () => {
    const r = await createRestaurant();
    const [cur] = await getDb().select().from(restaurants).where(eq(restaurants.id, r.restaurantId));
    const info = { restaurantId: r.restaurantId, ticketCents: null, marginPct: null, tables: null, weeklyCustomers: null, description: null, address: null, opening: cur!.openingHours as never, now: NOW };
    expect(await updateRestaurantInfo(getDb(), { ...info, name: "Cantina ana@golpe.com" })).toEqual({ ok: false, erro: "nome_contato" });
    expect(await updateMenuItem(getDb(), { restaurantId: r.restaurantId, itemId: r.items.cannoli!, name: "Cannoli zap 11912345678", priceCents: 2200, category: "sobremesa", now: NOW })).toEqual({ ok: false, erro: "item_contato" });
    expect(await addMenuItem(getDb(), { restaurantId: r.restaurantId, name: "Doce i-food", priceCents: 1000, category: "sobremesa", now: NOW })).toEqual({ ok: false, erro: "item_marca" });
    const [it] = await getDb().select({ name: menuItems.name }).from(menuItems).where(eq(menuItems.id, r.items.cannoli!));
    expect(it!.name).toBe("Cannoli");
  });
});
