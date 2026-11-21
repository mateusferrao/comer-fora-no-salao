import { describe, expect, it } from "vitest";
import { hash32 } from "@/src/shared/hash32";
import { mulberry32 } from "@/src/shared/rng";

describe("hash32", () => {
  it("é determinístico e espalha", () => {
    expect(hash32("a:b")).toBe(hash32("a:b"));
    expect(hash32("a:b")).not.toBe(hash32("a:c"));
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 10_000; i++) buckets[hash32(`c${i}:r`) % 10]++;
    for (const b of buckets) expect(b).toBeGreaterThan(850);
  });
});

describe("mulberry32", () => {
  it("mesma semente → mesma sequência em [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
