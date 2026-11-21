import { describe, expect, it } from "vitest";
import { guardText } from "@/src/modules/ia/guardrails";

const ctx = { facts: { convites_A_usados_pct: 65 }, items: { p1: "Cannoli", p4: "Pizza 4 queijos" }, slots: { A: "Ter, Qua · 15h–18h" }, oferta: "um Cannoli grátis", beneficio: "uma Panna cotta grátis" };
const convite = { allowed: ["prato", "horario", "oferta"] as const, maxLen: 160, field: "textoConvite" as const };

describe("guardrails (D54, planejamento S2 §4.5)", () => {
  it("texto bom da IA passa", () => {
    expect(guardText("Volte {horario:A} e ganhe {oferta}: a tarde fica mais doce.", ctx, { ...convite, mode: "ia" })).toMatchObject({ ok: true, warnings: [] });
  });
  it("número fora de referência reprova a IA; dentro de {prato} (Pizza 4 queijos) passa", () => {
    expect(guardText("Ganhe 50% off na volta", ctx, { ...convite, mode: "ia" }).ok).toBe(false);
    expect(guardText("Volte e peça {prato:p4} com {oferta}.", ctx, { ...convite, mode: "ia" }).ok).toBe(true);
  });
  it("palavras proibidas: 'metade do preço', 'grátis', 'imperdível'", () => {
    const r = guardText("Metade do preço, imperdível e grátis!", ctx, { ...convite, mode: "ia" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reasons).toEqual(expect.arrayContaining(["proibida:metade", "proibida:imperdivel", "proibida:gratis"]));
  });
  it("'desconto' só é proibido no texto do convite; na justificativa passa", () => {
    expect(guardText("Um desconto no prato atrai a mesa.", ctx, { allowed: ["fato", "prato", "horario", "oferta"], maxLen: 400, field: "justificativa", mode: "ia" }).ok).toBe(true);
    expect(guardText("Volte e ganhe desconto.", ctx, { ...convite, mode: "ia" }).ok).toBe(false);
  });
  it("PII e referência desconhecida reprovam até o texto do dono", () => {
    expect(guardText("Fale com joao@exemplo.com", ctx, { ...convite, mode: "dono" }).ok).toBe(false);
    expect(guardText("Volte {fato:inexistente}", ctx, { ...convite, mode: "dono" }).ok).toBe(false);
    expect(guardText("<b>Volte</b>", ctx, { ...convite, mode: "dono" }).ok).toBe(false);
  });
  it("texto do dono: números e palavras proibidas só avisam (D125)", () => {
    const r = guardText("Volte e ganhe 50% off, imperdível!", ctx, { ...convite, mode: "dono" });
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual(expect.arrayContaining(["numero", "proibida:imperdivel"]));
  });
  it("tamanho medido depois de renderizar as referências", () => {
    const long = "Volte {horario:A} e ganhe {oferta} " + "a".repeat(120);
    expect(guardText(long, ctx, { ...convite, mode: "ia" }).ok).toBe(false);
  });
  it("kit: dia/turno e item do convite reprovam (protege o holdout)", () => {
    const kit = { allowed: ["beneficio", "prato"] as const, maxLen: 120, field: "kit" as const, mode: "ia" as const, forbidDayTurn: true, forbidItemIds: ["p1"] };
    expect(guardText("Ganhe {beneficio} hoje!", ctx, kit).ok).toBe(true);
    expect(guardText("Volte na terça à tarde", ctx, kit).ok).toBe(false);
    expect(guardText("Prove o {prato:p1}", ctx, kit).ok).toBe(false);
  });
});
