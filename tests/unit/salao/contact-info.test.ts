import { describe, expect, it } from "vitest";
import { hasContactInfo } from "@/src/modules/salao/domain/contact-info";

describe("D174: texto do dono com link ou contato não vai por e-mail", () => {
  it("detecta link, e-mail e telefone", () => {
    expect(hasContactInfo("Volte terça e ganhe um cannoli!")).toBe(false);
    expect(hasContactInfo("Volte às 15h e ganhe 2 cafés")).toBe(false);
    expect(hasContactInfo("Acesse www.golpe.com")).toBe(true);
    expect(hasContactInfo("veja https://x.io/a")).toBe(true);
    expect(hasContactInfo("site golpe.com.br")).toBe(true);
    expect(hasContactInfo("fale com ana@x.com")).toBe(true);
    expect(hasContactInfo("ligue (11) 91234-5678")).toBe(true);
    expect(hasContactInfo("zap 11912345678")).toBe(true);
  });
});
