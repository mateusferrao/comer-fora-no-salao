import { describe, expect, it } from "vitest";
import { decryptEmail, encryptEmail, hmacCustomerEmail, hmacEmail } from "@/src/shared/crypto";

describe("e-mail do cliente e do dono (S4, D169)", () => {
  it("criptografa e descriptografa ida e volta, com IV novo a cada vez", () => {
    const a = encryptEmail("ana@exemplo.com");
    const b = encryptEmail("ana@exemplo.com");
    expect(a).not.toBe(b);
    expect(a).not.toContain("ana");
    expect(decryptEmail(a)).toBe("ana@exemplo.com");
    expect(decryptEmail(b)).toBe("ana@exemplo.com");
  });

  it("texto adulterado não descriptografa", () => {
    const a = encryptEmail("ana@exemplo.com");
    const [v, iv, tag, ct] = a.split(".");
    const flipped = Buffer.from(ct!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    expect(decryptEmail(`${v}.${iv}.${tag}.${flipped.toString("base64url")}`)).toBeNull();
    expect(decryptEmail("lixo")).toBeNull();
  });

  it("HMAC do cliente tem finalidade própria (≠ do dono para o mesmo e-mail)", () => {
    expect(hmacCustomerEmail("ana@exemplo.com")).toMatch(/^[0-9a-f]{64}$/);
    expect(hmacCustomerEmail("ana@exemplo.com")).not.toBe(hmacEmail("ana@exemplo.com"));
    expect(hmacCustomerEmail("ana@exemplo.com")).toBe(hmacCustomerEmail("ana@exemplo.com"));
  });
});
