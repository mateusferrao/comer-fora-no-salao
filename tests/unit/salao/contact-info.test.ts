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
  it("revisão S9: telefone com dígitos separados, @perfil, palavras de contato e domínio curto", () => {
    expect(hasContactInfo("ligue 11 9 87 65 43 21")).toBe(true);
    expect(hasContactInfo("ligue 11.98765.4321")).toBe(true);
    expect(hasContactInfo("siga @cantinadabia")).toBe(true);
    expect(hasContactInfo("cantina arroba gmail ponto com")).toBe(true);
    expect(hasContactInfo("chama no zap")).toBe(true);
    expect(hasContactInfo("manda no WhatsApp")).toBe(true);
    expect(hasContactInfo("linktr.ee/cantina")).toBe(true);
  });
  it("revisão S9: recado comum com horário, preço e quantidade continua indo por e-mail", () => {
    expect(hasContactInfo("Volte às 15h e ganhe 2 cafés. Até sexta.")).toBe(false);
    expect(hasContactInfo("A promoção vale de 10 a 20 de dezembro.")).toBe(false);
    expect(hasContactInfo("Obrigado pela visita, volte logo")).toBe(false);
    expect(hasContactInfo("Instante de sossego na nossa varanda")).toBe(false);
  });
});
