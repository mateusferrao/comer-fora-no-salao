import { afterEach, describe, expect, it, vi } from "vitest";
import { createHealthHandler } from "@/src/shared/health";

describe("createHealthHandler", () => {
  afterEach(() => vi.useRealTimers());

  it("responde 200 com db up quando o ping resolve", async () => {
    const handler = createHealthHandler({ ping: () => Promise.resolve(), sha: "abc" });
    const res = await handler();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "up", sha: "abc" });
  });

  it("responde 503 com db down quando o ping rejeita", async () => {
    const handler = createHealthHandler({ ping: () => Promise.reject(new Error("sem banco")), sha: "abc" });
    const res = await handler();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: "down", sha: "abc" });
  });

  it("responde 503 quando o ping demora mais de 2 s", async () => {
    vi.useFakeTimers();
    const handler = createHealthHandler({ ping: () => new Promise<void>(() => {}), sha: "abc" });
    const pending = handler();
    await vi.advanceTimersByTimeAsync(2_001);
    const res = await pending;
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: "down", sha: "abc" });
  });

  it("não guarda cache", async () => {
    const res = await createHealthHandler({ ping: () => Promise.resolve(), sha: "abc" })();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("health com o estado do seed (S1, T-I2)", () => {
  it("seed ok → 200 com seed:'ok'", async () => {
    const res = await createHealthHandler({ ping: () => Promise.resolve(), sha: "abc", seed: () => ({ state: "ok" }) })();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "up", sha: "abc", seed: "ok" });
  });
  it("seed rodando → 503 com o banco up", async () => {
    const res = await createHealthHandler({ ping: () => Promise.resolve(), sha: "abc", seed: () => ({ state: "rodando" }) })();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: "up", sha: "abc", seed: "rodando" });
  });
  it("seed falhou → 503 sem expor o motivo (pode ter dados da consulta)", async () => {
    const res = await createHealthHandler({ ping: () => Promise.resolve(), sha: "abc", seed: () => ({ state: "falhou", reason: "x" }) })();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: "up", sha: "abc", seed: "falhou" });
  });
});

describe("health com o estado do e-mail (S2, T-I7)", () => {
  it("mail ausente aparece mas não derruba o ok", async () => {
    const res = await createHealthHandler({ ping: () => Promise.resolve(), sha: "abc", mail: () => "ausente" })();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "up", sha: "abc", mail: "ausente" });
  });
});
