import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, isNotNull } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { customerContacts, customers, simulationRuns } from "@/src/db/schema";
import { decryptEmail, decryptPhone } from "@/src/shared/crypto";
import { backfillSimulatedContacts } from "@/src/modules/simulacao/application/backfill-contacts";
import { loadCustomerRows } from "@/src/modules/analytics/application/customers";
import { createRestaurant, resetDb } from "./helpers/db";

describe("contato completo (D237): backfill dos clientes simulados", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("gera telefone (00) com os mesmos 4 últimos e e-mail exemplo.invalid; idempotente; cliente real fica como está", async () => {
    const r = await createRestaurant();
    const [run] = await getDb().insert(simulationRuns).values({ kind: "vitrine", restaurantId: r.restaurantId, seed: 1, version: 1, params: {} }).returning({ id: simulationRuns.id });
    const [sim] = await getDb().insert(customers).values({ simulationRunId: run!.id }).returning({ id: customers.id });
    await getDb().insert(customerContacts).values({ customerId: sim!.id, name: "Júlia Mendes", phoneLast4: "4321" });
    const [real] = await getDb().insert(customers).values({}).returning({ id: customers.id });
    await getDb().insert(customerContacts).values({ customerId: real!.id, name: "Pessoa Real", phoneLast4: "1111" });

    expect(await backfillSimulatedContacts(getDb())).toBe(1);
    expect(await backfillSimulatedContacts(getDb())).toBe(0);
    const [s] = await getDb().select().from(customerContacts).where(eq(customerContacts.customerId, sim!.id));
    expect(decryptPhone(s!.phoneEnc)).toMatch(/^\(00\) 9\d{4}-4321$/);
    expect(decryptEmail(s!.emailEnc)).toMatch(/^julia\.mendes\.[a-z0-9]{6}@exemplo\.invalid$/);
    expect(s!.emailHmac).toBeNull();
    const [p] = await getDb().select().from(customerContacts).where(eq(customerContacts.customerId, real!.id));
    expect(p!.phoneEnc).toBeNull();
    expect(p!.emailEnc).toBeNull();
  });

  it("fora da tela de Clientes (insights do plano, reativação) o contato não é decifrado (D161)", async () => {
    const { seedAll } = await import("@/src/db/seed");
    const { vitrineHistory } = await import("@/src/db/seed/history");
    const { fixedClock } = await import("@/src/shared/clock");
    const { VITRINE_ID } = await import("@/src/db/seed/vitrine");
    await seedAll(getDb(), fixedClock("2026-11-21T12:00:00Z"), vitrineHistory);
    const plain = await loadCustomerRows(getDb(), VITRINE_ID, new Date("2026-11-21T12:00:00Z"));
    expect(plain.every((c) => c.phone === "" && c.email === "")).toBe(true);
    const owner = await loadCustomerRows(getDb(), VITRINE_ID, new Date("2026-11-21T12:00:00Z"), { contact: true });
    expect(owner.some((c) => c.email.endsWith("@exemplo.invalid"))).toBe(true);
  });

  it("o seed da vitrine já nasce com contato fictício (sem e-mail de login)", async () => {
    const { seedAll } = await import("@/src/db/seed");
    const { vitrineHistory } = await import("@/src/db/seed/history");
    const { fixedClock } = await import("@/src/shared/clock");
    await seedAll(getDb(), fixedClock("2026-11-21T12:00:00Z"), vitrineHistory);
    const rows = await getDb()
      .select({ phone: customerContacts.phoneEnc, email: customerContacts.emailEnc, hmac: customerContacts.emailHmac })
      .from(customerContacts)
      .innerJoin(customers, eq(customers.id, customerContacts.customerId))
      .where(isNotNull(customers.simulationRunId))
      .limit(20);
    expect(rows.length).toBeGreaterThan(0);
    for (const x of rows) {
      expect(decryptPhone(x.phone)).toMatch(/^\(00\) 9\d{4}-\d{4}$/);
      expect(decryptEmail(x.email)).toMatch(/@exemplo\.invalid$/);
      expect(x.hmac).toBeNull();
    }
  });
});
