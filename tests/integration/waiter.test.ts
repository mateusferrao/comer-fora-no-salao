import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/src/db/client";
import { activeWaiterToken, createWaiterToken, resolveWaiterSession, resolveWaiterToken, revokeWaiterTokens } from "@/src/modules/salao/application/waiter-tokens";
import { createRestaurant, resetDb } from "./helpers/db";

const NOW = new Date("2026-11-21T15:00:00Z");

describe("link do garçom (S6.2, D190)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("criar mostra o token 1 vez, guarda só o hash; criar de novo revoga o anterior (1 ativo)", async () => {
    const r = await createRestaurant();
    const a = await createWaiterToken(getDb(), { restaurantId: r.restaurantId, now: NOW });
    expect(a.token).toMatch(/^gc_[A-Za-z0-9_-]{43}$/);
    const ra = await resolveWaiterToken(getDb(), a.token);
    expect(ra?.restaurantId).toBe(r.restaurantId);
    const b = await createWaiterToken(getDb(), { restaurantId: r.restaurantId, now: new Date(NOW.getTime() + 1000) });
    expect(await resolveWaiterToken(getDb(), a.token)).toBeNull();
    expect((await resolveWaiterToken(getDb(), b.token))?.restaurantId).toBe(r.restaurantId);
    expect((await activeWaiterToken(getDb(), r.restaurantId))?.createdAt.toISOString()).toBe(new Date(NOW.getTime() + 1000).toISOString());
  });

  it("revogar corta na hora; a sessão (cookie com o id) também deixa de valer", async () => {
    const r = await createRestaurant();
    const a = await createWaiterToken(getDb(), { restaurantId: r.restaurantId, now: NOW });
    const t = (await resolveWaiterToken(getDb(), a.token))!;
    expect((await resolveWaiterSession(getDb(), t.id))?.restaurantName).toBe("Cantina de Teste");
    await revokeWaiterTokens(getDb(), r.restaurantId, NOW);
    expect(await resolveWaiterToken(getDb(), a.token)).toBeNull();
    expect(await resolveWaiterSession(getDb(), t.id)).toBeNull();
    expect(await activeWaiterToken(getDb(), r.restaurantId)).toBeNull();
  });

  it("formato inválido ou desconhecido → null, sem ir ao banco com lixo", async () => {
    expect(await resolveWaiterToken(getDb(), "")).toBeNull();
    expect(await resolveWaiterToken(getDb(), "gc_curto")).toBeNull();
    expect(await resolveWaiterToken(getDb(), `gc_${"a".repeat(43)}`)).toBeNull();
    expect(await resolveWaiterSession(getDb(), "nao-e-uuid")).toBeNull();
  });
});
