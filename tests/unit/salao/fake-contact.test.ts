import { describe, expect, it } from "vitest";
import { fakeEmail, fakePhone, PHONE_PATTERN } from "@/src/modules/salao/domain/phone";

describe("contato fictício óbvio dos clientes simulados (D237)", () => {
  it("telefone com DDD 00, no formato do app, mantendo os 4 últimos; determinístico pelo id", () => {
    const p = fakePhone("8c1f-aa", "4321");
    expect(p).toMatch(/^\(00\) 9\d{4}-4321$/);
    expect(PHONE_PATTERN.test(p)).toBe(true);
    expect(fakePhone("8c1f-aa", "4321")).toBe(p);
    expect(fakePhone("outro-id", "4321")).toMatch(/-4321$/);
  });
  it("e-mail em exemplo.invalid, sem acento, a partir do nome", () => {
    expect(fakeEmail("Júlia Mendes", "ab12-cd")).toMatch(/^julia\.mendes\.[0-9a-z]{6}@exemplo\.invalid$/);
    expect(fakeEmail("", "x")).toMatch(/^cliente\.[0-9a-z]{6}@exemplo\.invalid$/);
    // Ids com o mesmo começo geram e-mails diferentes.
    expect(fakeEmail("Ana Alves", "5f64aaaa-0001")).not.toBe(fakeEmail("Ana Alves", "5f64aaaa-0002"));
  });
});
