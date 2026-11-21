import { describe, expect, it } from "vitest";
import { slugify } from "@/src/shared/slug";

describe("slug pelo nome (S4 §4.4)", () => {
  it("minúsculas, sem acento, hífens, até 40 caracteres", () => {
    expect(slugify("Pizzaria do João")).toBe("pizzaria-do-joao");
    expect(slugify("  Café & Cia.  ")).toBe("cafe-cia");
    expect(slugify("Ç".repeat(3))).toBe("ccc");
    expect(slugify("x".repeat(60))).toHaveLength(40);
    expect(slugify("!!!")).toBe("restaurante");
  });
});
