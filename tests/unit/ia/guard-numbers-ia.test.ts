import { describe, expect, it } from "vitest";
import { guardText, type GuardField } from "@/src/modules/ia/guardrails";

// S9 (auditoria A1): número por extenso e promessa extra valem em todos os campos escritos pela IA, não só no chat.
const ctx = { items: { p1: "Pizza quatro queijos" }, slots: { A: "terça, das 15h às 18h" }, oferta: "Cannoli grátis", facts: { mesas: 20 }, beneficio: "Panna cotta grátis", recompensa: "Tiramisù" };
const allowed = ["prato", "horario", "oferta", "fato", "beneficio", "recompensa"] as const;
const ia = (field: GuardField, t: string) => guardText(t, ctx, { allowed, maxLen: 400, field, mode: "ia" });
const dono = (field: GuardField, t: string) => guardText(t, ctx, { allowed, maxLen: 400, field, mode: "dono" });

describe("guard em modo ia: número por extenso em todos os campos (S9, A1)", () => {
  it("'duas caipirinhas' no kit reprova", () => {
    const g = ia("kit", "Ganhe {beneficio} e duas caipirinhas");
    expect(!g.ok && g.reasons).toContain("numero_extenso:duas");
  });
  it("'dez por cento' no convite reprova", () => {
    const g = ia("textoConvite", "Volte {horario:A} e ganhe dez por cento off");
    expect(!g.ok && g.reasons).toEqual(expect.arrayContaining(["numero_extenso:dez", "numero_extenso:por cento"]));
  });
  it("'triplicar' e 'vinte' na justificativa reprovam", () => {
    const g = ia("justificativa", "Vai triplicar o movimento: são vinte mesas.");
    expect(!g.ok && g.reasons).toEqual(expect.arrayContaining(["numero_extenso:triplic", "numero_extenso:vinte"]));
  });
  it("vale também no 'o que aprendemos'", () => {
    expect(ia("aprendemos", "O convite trouxe dois clientes.").ok).toBe(false);
  });
  it("nome de prato citado por referência não conta ('quatro queijos')", () => {
    expect(ia("textoConvite", "Volte {horario:A} e aproveite {oferta} com {prato:p1}.")).toEqual({ ok: true, warnings: [] });
  });
  it("artigo 'um/uma' segue liberado", () => {
    expect(ia("kit", "Faça check-in e ganhe {beneficio} numa visita").ok).toBe(true);
  });
  it("texto do dono: número por extenso não vira aviso novo (D125 inalterado)", () => {
    expect(dono("textoConvite", "Volte {horario:A} com dois amigos")).toEqual({ ok: true, warnings: [] });
  });
});

describe("promessa extra no convite e no kit (S9, A1)", () => {
  it("'de brinde' e 'por conta da casa' reprovam no convite e no kit", () => {
    expect(!ia("textoConvite", "Volte {horario:A}: {oferta} e uma taça de brinde.").ok).toBe(true);
    expect(!ia("kit", "Uma taça por conta da casa").ok).toBe(true);
    expect(!ia("kit", "Brinde surpresa pra mesa toda").ok).toBe(true);
  });
  it("'cortesia' continua permitida (é tipo de oferta)", () => {
    expect(ia("textoConvite", "Volte {horario:A} e aproveite a cortesia: {oferta}.").ok).toBe(true);
  });
});
