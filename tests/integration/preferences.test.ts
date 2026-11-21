import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { customerMessages, customers, invites, restaurantCustomers } from "@/src/db/schema";
import { linkPatchAllowed, listCustomerPrefs, prefsTarget, setCustomerPrefs } from "@/src/modules/salao/application/preferences";
import { unsubscribeToken } from "@/src/modules/salao/application/deliver-messages";
import { createRestaurant, resetDb } from "./helpers/db";

describe("central de preferências do cliente (S6.1, D198)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  async function setup() {
    const r = await createRestaurant();
    const id = crypto.randomUUID();
    await getDb().insert(customers).values({ id });
    await getDb().insert(restaurantCustomers).values({ restaurantId: r.restaurantId, customerId: id });
    const [inv] = await getDb()
      .insert(invites)
      .values({ restaurantId: r.restaurantId, customerId: id, slotId: r.slots.A!, slotSnapshot: { days: [2], startMin: 900, endMin: 1080 }, arm: "convidavel", status: "ativo", origin: "mesa", issuedAt: new Date(), issuedDay: "2026-11-21", weekKey: "2026-W47", expiresAt: new Date(Date.now() + 86_400_000) } as never)
      .returning({ id: invites.id });
    await getDb().insert(customerMessages).values([
      { customerId: id, restaurantId: r.restaurantId, inviteId: inv!.id, kind: "convite_mesa", emailStatus: "pendente" },
      { customerId: id, restaurantId: r.restaurantId, inviteId: inv!.id, kind: "lembrete", emailStatus: "pendente" },
    ]);
    return { ...r, customerId: id };
  }
  const status = async (customerId: string, kind: string) =>
    (await getDb().select().from(customerMessages).where(and(eq(customerMessages.customerId, customerId), eq(customerMessages.kind, kind))))[0]!;

  it("padrão: tudo ligado; desligar 'Lembretes' pula só o lembrete pendente", async () => {
    const r = await setup();
    expect(await listCustomerPrefs(getDb(), r.customerId)).toEqual([{ restaurantId: r.restaurantId, restaurant: "Cantina de Teste", email: true, convites: true, lembretes: true, app: true }]);
    await setCustomerPrefs(getDb(), { customerId: r.customerId, restaurantId: r.restaurantId, patch: { lembretes: false } });
    expect((await status(r.customerId, "lembrete")).emailStatus).toBe("pulado");
    expect((await status(r.customerId, "lembrete")).emailSkipReason).toBe("cliente_desligou");
    expect((await status(r.customerId, "convite_mesa")).emailStatus).toBe("pendente");
  });

  it("chave-mestra desligada pula tudo; 'Convites de volta no app' grava opt_app", async () => {
    const r = await setup();
    const x = await setCustomerPrefs(getDb(), { customerId: r.customerId, restaurantId: r.restaurantId, patch: { email: false, app: false } });
    expect(x).toMatchObject({ email: false, app: false, convites: true, lembretes: true });
    expect((await status(r.customerId, "convite_mesa")).emailStatus).toBe("pulado");
    const [rc] = await getDb().select().from(restaurantCustomers).where(eq(restaurantCustomers.customerId, r.customerId));
    expect(rc).toMatchObject({ optEmail: false, optApp: false });
  });

  it("token do e-mail: assinado e amarrado ao par cliente × restaurante; forjado → null", async () => {
    const r = await setup();
    expect(prefsTarget(unsubscribeToken(r.customerId, r.restaurantId))).toEqual({ customerId: r.customerId, restaurantId: r.restaurantId });
    expect(prefsTarget(`descadastro:${r.customerId}:${r.restaurantId}.forjado`)).toBeNull();
    // Restaurante onde o cliente nunca esteve → nada muda.
    expect(await setCustomerPrefs(getDb(), { customerId: r.customerId, restaurantId: crypto.randomUUID(), patch: { email: false } })).toBeNull();
  });
});

describe("link do e-mail só desliga (revisão S4–S6, segurança 5)", () => {
  it("desligar passa; qualquer ligar é recusado (exige a sessão na Jornada)", () => {
    expect(linkPatchAllowed({ lembretes: false })).toBe(true);
    expect(linkPatchAllowed({ email: false, app: false })).toBe(true);
    expect(linkPatchAllowed({ email: true })).toBe(false);
    expect(linkPatchAllowed({ convites: false, app: true })).toBe(false);
  });
});
