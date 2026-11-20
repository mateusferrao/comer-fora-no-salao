import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/src/db/client";
import { consume } from "@/src/shared/rate-limit";
import { resetDb } from "./helpers/db";

describe("limites persistidos (consume)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("20 chamadas paralelas com limite 10 → exatamente 10 passam", async () => {
    const now = new Date("2026-11-21T12:00:30Z");
    const rs = await Promise.all(Array.from({ length: 20 }, () => consume(getDb(), "teste:par", 10, 60, now)));
    expect(rs.filter((r) => r.ok)).toHaveLength(10);
    const neg = rs.find((r) => !r.ok);
    expect(neg && !neg.ok && neg.retryAfterSec).toBe(30);
  });

  it("janela nova zera a contagem; chaves diferentes não se misturam", async () => {
    const t0 = new Date("2026-11-21T12:00:00Z");
    expect((await consume(getDb(), "k", 1, 60, t0)).ok).toBe(true);
    expect((await consume(getDb(), "k", 1, 60, t0)).ok).toBe(false);
    expect((await consume(getDb(), "outra", 1, 60, t0)).ok).toBe(true);
    expect((await consume(getDb(), "k", 1, 60, new Date("2026-11-21T12:01:00Z"))).ok).toBe(true);
  });

  it("limite diário vira à meia-noite de SP, não às 21h (revisão S2 #37 / D150)", async () => {
    const at = (iso: string) => new Date(iso);
    // 20h59 e 21h01 em SP (23h59 e 00h01 UTC): mesma janela.
    expect(await consume(getDb(), "dia:x", 1, 86_400, at("2026-11-20T23:59:00Z"))).toMatchObject({ ok: true });
    expect(await consume(getDb(), "dia:x", 1, 86_400, at("2026-11-21T00:01:00Z"))).toMatchObject({ ok: false });
    // 23h59 e 00h01 em SP (02h59 e 03h01 UTC): janelas diferentes.
    expect(await consume(getDb(), "dia:y", 1, 86_400, at("2026-11-21T02:59:00Z"))).toMatchObject({ ok: true });
    expect(await consume(getDb(), "dia:y", 1, 86_400, at("2026-11-21T03:01:00Z"))).toMatchObject({ ok: true });
    // retryAfter conta até a meia-noite de SP.
    await consume(getDb(), "dia:z", 1, 86_400, at("2026-11-21T22:00:00Z"));
    const r = await consume(getDb(), "dia:z", 1, 86_400, at("2026-11-21T22:00:00Z"));
    expect(r).toMatchObject({ ok: false, retryAfterSec: 5 * 3600 });
  });
});
