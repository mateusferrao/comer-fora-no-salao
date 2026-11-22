import { describe, expect, it } from "vitest";
import { inviteExtra } from "@/src/modules/salao/domain/invite-text";

/** S9: o texto do convite que só repete "Volte {quando} e ganhe {oferta}" não aparece de novo embaixo da 1ª linha. */
describe("inviteExtra", () => {
  const gain = "Cannoli grátis";
  it("sem texto, ou texto que só repete a 1ª linha → nada", () => {
    expect(inviteExtra(null, gain)).toBeNull();
    expect(inviteExtra("Volte terça, quarta e quinta, das 15h às 18h e aproveite Cannoli grátis.", gain)).toBeNull();
  });
  it("texto que repete a 1ª linha e acrescenta algo → só o acréscimo", () => {
    expect(inviteExtra("Volte terça, quarta e quinta, das 15h às 18h e ganhe Cannoli grátis: o doce da casa com o seu café.", gain)).toBe("O doce da casa com o seu café.");
    expect(inviteExtra("Volte segunda, das 21h às 23h e ganhe Cannoli grátis para petiscar.", gain)).toBe("Para petiscar.");
    // S7 (D325): a IA fecha a 1ª frase com "!" ou "?" — o resto não pode começar pela pontuação.
    expect(inviteExtra("Volte terça, quarta e quinta, das 15h às 18h e ganhe Cannoli grátis! Esperamos você.", gain)).toBe("Esperamos você.");
    expect(inviteExtra("Volte terça, quarta e quinta, das 15h às 18h e ganhe Cannoli grátis?! Vem com a gente.", gain)).toBe("Vem com a gente.");
  });
  it("texto próprio do dono fica como está", () => {
    expect(inviteExtra("O doce da casa combina com o seu café.", gain)).toBe("O doce da casa combina com o seu café.");
    expect(inviteExtra("Volte logo para provar a massa fresca.", gain)).toBe("Volte logo para provar a massa fresca.");
  });
});
