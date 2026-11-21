import { describe, expect, it } from "vitest";
import { guardText } from "@/src/modules/ia/guardrails";
import { textIssues } from "@/src/modules/ia/guardrails/messages";

const ctx = {
  items: { p1: "Bruschetta" },
  slots: { A: "terça, das 15h às 18h" },
  oferta: "uma bruschetta",
};
const dono = {
  allowed: ["prato", "horario", "oferta"] as const,
  maxLen: 160,
  field: "textoConvite" as const,
  mode: "dono" as const,
};
const issues = (t: string) =>
  textIssues(guardText(t, ctx, dono), { maxLen: 160 });

describe("textIssues (ajuste de 21/11: mensagens que dizem o que fazer)", () => {
  it("texto bom: sem erro nem aviso", () => {
    expect(issues("Volte terça à tarde e ganhe uma bruschetta.")).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it("vazio pede para escrever ou voltar ao sugerido", () => {
    expect(issues("   ").errors).toEqual([
      "Escreva o texto do convite ou volte ao texto sugerido.",
    ]);
  });

  it("longo diz quantos caracteres tem e quantos tirar", () => {
    expect(issues("a".repeat(171)).errors).toEqual([
      "Está com 171 caracteres; o limite é 160. Tire 11.",
    ]);
  });

  it("contato pessoal e HTML dizem o que tirar", () => {
    expect(issues("Fale com joao@exemplo.com").errors).toEqual([
      "Tire e-mail, telefone ou CPF: o convite vai para muitos clientes.",
    ]);
    expect(issues("Volte <b>já</b>").errors).toEqual([
      "Tire os sinais < > { }: eles não aparecem como você espera para o cliente.",
    ]);
  });

  it("número e promessa só avisam", () => {
    const r = issues("Volte e ganhe 50% grátis");
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([
      "O texto cita número, preço ou promessa (ex.: “grátis”). Quem decide o benefício é a oferta acima; o garçom valida só ela.",
    ]);
  });

  it("referência desconhecida explica as marcações aceitas", () => {
    expect(issues("Volte e ganhe {prato:p9}").errors).toEqual([
      "A marcação {prato:p9} não existe. Escreva o texto sem chaves ou volte ao texto sugerido.",
    ]);
    expect(issues("Volte e ganhe {brinde}").errors).toEqual([
      "Tire os sinais < > { }: eles não aparecem como você espera para o cliente.",
    ]);
  });

  it("sem repetir a mesma mensagem", () => {
    expect(issues("a@b.com 11999998888").errors).toHaveLength(1);
  });
});
