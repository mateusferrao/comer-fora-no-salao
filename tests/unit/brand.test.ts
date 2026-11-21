import { describe, expect, it } from "vitest";
import { mentionsIfood } from "@/src/shared/brand";

describe("nome de restaurante sem a marca iFood (revisão S4–S6)", () => {
  it.each(["iFood Suporte", "IFOOD", "i-food Lanches", "Cantina i food", "Ｉｆｏｏｄ", "ïFood"])("recusa %s", (n) => expect(mentionsIfood(n)).toBe(true));
  it.each(["Cantina Nonna Lúcia", "Wi-Fi Food Bar", "Food Truck do Zé", "Seafood House"])("aceita %s", (n) => expect(mentionsIfood(n)).toBe(false));
});
