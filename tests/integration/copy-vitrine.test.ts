import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { checkins, codes, invites, owners, pieceVariants, restaurantCustomers, restaurants } from "@/src/db/schema";
import { seedAll } from "@/src/db/seed";
import { vitrineHistory } from "@/src/db/seed/history";
import { VITRINE_ID } from "@/src/db/seed/vitrine";
import { cleanupStaleAccounts } from "@/src/modules/contas/application/cleanup";
import { copyVitrineFor } from "@/src/modules/contas/application/copy-vitrine";
import { fixedClock } from "@/src/shared/clock";
import { resetDb } from "./helpers/db";

const NOW = new Date("2026-11-21T15:00:00Z");

async function counts(restaurantId: string) {
  const c = async (t: typeof checkins | typeof invites | typeof codes | typeof restaurantCustomers) =>
    (await getDb().select({ n: sql<number>`count(*)::int` }).from(t).where(eq(t.restaurantId, restaurantId)))[0]!.n;
  const holdout = (await getDb().select({ n: sql<number>`count(*)::int` }).from(restaurantCustomers).where(and(eq(restaurantCustomers.restaurantId, restaurantId), eq(restaurantCustomers.arm, "holdout"))))[0]!.n;
  return { checkins: await c(checkins), invites: await c(invites), codes: await c(codes), clientes: await c(restaurantCustomers), holdout };
}

describe("cópia da vitrine por conta (D119, revisão T-B1)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("2 contas → 2 cópias sem conflito, com os mesmos números da original; tokens com sufixo; 2ª chamada não duplica", async () => {
    await seedAll(getDb(), fixedClock(NOW.toISOString()), vitrineHistory);
    const [a, b] = await getDb().insert(owners).values([{ kind: "teste", via: "email", emailHmac: "a" }, { kind: "teste", via: "link" }]).returning({ id: owners.id });
    expect(await Promise.all([copyVitrineFor(a!.id, NOW, getDb()), copyVitrineFor(b!.id, NOW, getDb())])).toEqual(["criada", "criada"]);
    expect(await copyVitrineFor(a!.id, NOW, getDb())).toBe("existente");
    const copies = await getDb().select().from(restaurants).where(eq(restaurants.copiedFrom, VITRINE_ID));
    expect(copies).toHaveLength(2);
    expect(copies.every((r) => r.setupStatus === "pronta" && !r.protected && r.kind === "vitrine" && /^cantina-nonna-lucia-[a-z2-9]{6}$/.test(r.slug))).toBe(true);
    const orig = await counts(VITRINE_ID);
    expect(orig.checkins).toBeGreaterThan(1000);
    for (const r of copies) expect(await counts(r.id)).toEqual(orig);
    const toks = await getDb().select({ t: pieceVariants.qrToken }).from(pieceVariants).where(eq(pieceVariants.restaurantId, copies[0]!.id));
    expect(toks.every((x) => /^nl-(display-[ab]|cartaz-[ab]|garcom)-[a-z2-9]{6}$/.test(x.t))).toBe(true);
  }, 120_000);

  it("limpeza: apaga conta inativa há 7 dias (com a cópia); poupa ativa, seed e protegida", async () => {
    await seedAll(getDb(), fixedClock(NOW.toISOString()), vitrineHistory);
    const old = new Date(NOW.getTime() - 8 * 86_400_000);
    const [velha, nova] = await getDb().insert(owners).values([{ kind: "teste", via: "email", emailHmac: "v", lastSeenAt: old }, { kind: "teste", via: "email", emailHmac: "n", lastSeenAt: NOW }]).returning({ id: owners.id });
    await copyVitrineFor(velha!.id, NOW, getDb());
    expect(await cleanupStaleAccounts(getDb(), NOW)).toBe(1);
    const left = await getDb().select({ id: owners.id }).from(owners);
    expect(left.map((o) => o.id)).toContain(nova!.id);
    expect(left.map((o) => o.id)).not.toContain(velha!.id);
    expect(await getDb().select().from(restaurants).where(eq(restaurants.copiedFrom, VITRINE_ID))).toHaveLength(0);
    expect((await getDb().select().from(restaurants).where(eq(restaurants.id, VITRINE_ID))).length).toBe(1);
  }, 120_000);
});
