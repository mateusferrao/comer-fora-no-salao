import { describe, expect, it, vi } from "vitest";
import { retryUntil } from "@/src/shared/retry";

function fakeTime() {
  let t = 0;
  return {
    now: () => t,
    sleep: vi.fn(async (ms: number) => {
      t += ms;
    }),
  };
}

describe("retryUntil", () => {
  it("devolve ok na primeira tentativa que dá certo", async () => {
    const time = fakeTime();
    const fn = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce("feito");
    const r = await retryUntil(fn, { totalMs: 30_000, initialDelayMs: 500, ...time });
    expect(r).toEqual({ ok: true, value: "feito", attempts: 2 });
  });

  it("espera de forma crescente entre as tentativas", async () => {
    const time = fakeTime();
    const fn = vi.fn().mockRejectedValue(new Error("x"));
    await retryUntil(fn, { totalMs: 10_000, initialDelayMs: 500, maxDelayMs: 4_000, ...time });
    expect(time.sleep.mock.calls.map((c) => c[0]).slice(0, 5)).toEqual([500, 1_000, 2_000, 4_000, 2_500]);
  });

  it("desiste ao estourar o tempo total e devolve o último erro", async () => {
    const time = fakeTime();
    const fn = vi.fn().mockRejectedValue(new Error("sem banco"));
    const r = await retryUntil(fn, { totalMs: 30_000, initialDelayMs: 500, maxDelayMs: 4_000, ...time });
    expect(r.ok).toBe(false);
    if (!r.ok) expect((r.error as Error).message).toBe("sem banco");
    expect(time.now()).toBeLessThanOrEqual(30_000);
    expect(time.now()).toBeGreaterThanOrEqual(29_000);
  });
});
