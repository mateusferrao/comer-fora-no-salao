import { describe, expect, it } from "vitest";
import { getSecret, MissingSecretError } from "@/src/shared/secrets";
import { hmacPhone, signValue, verifySigned } from "@/src/shared/crypto";

describe("segredos", () => {
  it("produção sem segredo → erro; desenvolvimento → valor fixo", () => {
    expect(() => getSecret("SESSION_SECRET", { NODE_ENV: "production" })).toThrow(MissingSecretError);
    expect(getSecret("SESSION_SECRET", { NODE_ENV: "test" })).toMatch(/dev-/);
    expect(getSecret("SESSION_SECRET", { NODE_ENV: "production", SESSION_SECRET: "x".repeat(32) })).toBe("x".repeat(32));
  });
});

describe("cookie assinado e HMAC", () => {
  it("verifica a própria assinatura e recusa adulteração", () => {
    const s = signValue("cliente-1");
    expect(verifySigned(s)).toBe("cliente-1");
    expect(verifySigned(s.replace("cliente-1", "cliente-2"))).toBeNull();
    expect(verifySigned("sem-assinatura")).toBeNull();
    expect(verifySigned(undefined)).toBeNull();
  });
  it("HMAC do telefone é estável e não contém o número", () => {
    const h = hmacPhone("00912345678");
    expect(h).toBe(hmacPhone("00912345678"));
    expect(h).not.toContain("912345678");
    expect(h).toHaveLength(64);
  });
});
