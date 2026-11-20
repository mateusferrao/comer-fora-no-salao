import { describe, expect, it } from "vitest";
import { parseOwnerValue } from "@/src/web/owner-session";

const ID = "4be0e052-401d-4016-aa13-7cd66c1bc48f";
const NOW = new Date("2026-11-23T20:00:00Z");

describe("sessão do dono vence no servidor (revisão da S2)", () => {
  it("aceita dentro dos 30 dias e recusa depois, sem data ou com data no futuro", () => {
    expect(parseOwnerValue(`${ID}:${NOW.getTime() - 29 * 86_400_000}`, NOW)).toBe(ID);
    expect(parseOwnerValue(`${ID}:${NOW.getTime() - 31 * 86_400_000}`, NOW)).toBeNull();
    expect(parseOwnerValue(ID, NOW)).toBeNull();
    expect(parseOwnerValue(`${ID}:${NOW.getTime() + 3_600_000}`, NOW)).toBeNull();
    expect(parseOwnerValue(null, NOW)).toBeNull();
  });
});
