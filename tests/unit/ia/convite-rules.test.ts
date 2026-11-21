import { describe, expect, it } from "vitest";
import { guardText } from "@/src/modules/ia/guardrails";

/** Regras determinísticas do convite (D226): dia e horário da faixa, sem artigo antes, sem repetir a oferta. */
const ctx = { slots: { A: "terça, quarta e quinta, das 15h às 18h", B: "sexta, das 21h às 23h" }, items: { p1: "Cannoli" }, oferta: "Cannoli grátis" };
const opts = (mode: "ia" | "dono" = "ia") => ({ allowed: ["prato", "horario", "oferta"] as const, maxLen: 160, field: "textoConvite" as const, mode, requireSlot: "A" });
const reasons = (t: string, mode: "ia" | "dono" = "ia") => {
  const g = guardText(t, ctx, opts(mode));
  return g.ok ? (mode === "dono" ? g.warnings : []) : g.reasons;
};

describe("convite com dia e horário (D226): tabela de casos", () => {
  it.each([
    ["Volte {horario:A} e aproveite {oferta}.", []],
    ["De {horario:A}, a casa guarda {oferta} pra você.", []],
    ["Volte {horario:A}: {oferta} com o café da tarde.", []],
    ["Volte logo e aproveite {oferta}!", ["sem_horario"]],
    ["Volte {horario:B} e aproveite {oferta}.", ["sem_horario"]],
    ["Volte no {horario:A} e aproveite {oferta}.", ["artigo_antes_do_horario"]],
    ["Te esperamos na {horario:A} com {oferta}.", ["artigo_antes_do_horario"]],
    ["Volte {horario:A}: {oferta} por nossa conta.", ["oferta_repetida"]],
    ["Volte {horario:A}: {oferta} de graça.", expect.arrayContaining(["oferta_repetida"])],
    ["Volte {horario:A} e prove {oferta} {prato:p1}.", ["oferta_repetida"]],
  ])("%s → %j", (texto, esperado) => {
    expect(reasons(texto)).toEqual(esperado);
  });

  it("no texto do dono as 3 regras só avisam", () => {
    expect(reasons("Volte logo e aproveite {oferta} por nossa conta!", "dono")).toEqual(expect.arrayContaining(["sem_horario", "oferta_repetida"]));
    expect(guardText("Volte logo!", ctx, opts("dono")).ok).toBe(true);
  });

  it("sem requireSlot (justificativa, kit) nada muda", () => {
    expect(guardText("A tarde está tranquila.", ctx, { allowed: ["horario", "oferta"], maxLen: 400, field: "justificativa", mode: "ia" }).ok).toBe(true);
  });
});
