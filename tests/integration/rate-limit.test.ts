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
});
