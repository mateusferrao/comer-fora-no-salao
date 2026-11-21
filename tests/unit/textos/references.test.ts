import { describe, expect, it } from "vitest";
import { formatFact, referencesIn, renderReferences, stripReferences, unknownRefs } from "@/src/modules/textos/domain/references";

const ctx = {
  facts: { convites_A_usados_pct: 65, ticket_medio: 8500, faixa_A_mesas: 12, faixa_A_intensidade: "muito" },
  items: { p1: "Cannoli", p4: "Pizza 4 queijos" },
  slots: { A: "Ter, Qua, Qui · 15h–18h" },
  oferta: "um Cannoli grátis",
  beneficio: "uma Panna cotta grátis",
};

describe("referências (módulo único — revisão T-I3)", () => {
  it("lista as referências, inclusive {beneficio} e {recompensa}", () => {
    expect(referencesIn("Volte {horario:A} e ganhe {oferta}. {beneficio} {recompensa} {fato:x} {prato:p1}")).toEqual([
      { kind: "horario", key: "A" },
      { kind: "oferta", key: "" },
      { kind: "beneficio", key: "" },
      { kind: "recompensa", key: "" },
      { kind: "fato", key: "x" },
      { kind: "prato", key: "p1" },
    ]);
  });
  it("fatos: _pct ganha %, ticket em reais, inteiros em pt-BR", () => {
    expect(formatFact("convites_A_usados_pct", 65)).toBe("65%");
    expect(formatFact("ticket_medio", 8500)).toBe("R$ 85,00");
    expect(formatFact("clientes_semana", 1400)).toBe("1.400 clientes por semana");
    expect(formatFact("faixa_A_intensidade", "muito")).toBe("muito");
  });
  it("renderiza com os textos do código; '{fato:x_pct}%' não vira '65%%'", () => {
    expect(renderReferences("Volte {horario:A} e ganhe {oferta}: {prato:p4}.", ctx)).toBe("Volte Ter, Qua, Qui · 15h–18h e ganhe um Cannoli grátis: Pizza 4 queijos.");
    expect(renderReferences("Uso de {fato:convites_A_usados_pct}", ctx)).toBe("Uso de 65%");
  });
  it("desconhecidas e não permitidas no campo", () => {
    expect(unknownRefs("{fato:nao_existe} {prato:p9} {horario:B} {oferta}", ctx, ["fato", "prato", "horario", "oferta"])).toEqual(["fato:nao_existe", "prato:p9", "horario:B"]);
    expect(unknownRefs("{beneficio}", ctx, ["oferta"])).toEqual(["beneficio (não permitida aqui)"]);
  });
  it("tira as referências (para checar dígitos fora delas)", () => {
    expect(stripReferences("Pizza {prato:p4} {fato:x_pct}")).toBe("Pizza  ");
  });
});

describe("fatos declarados com unidade (revisão da S2)", () => {
  it("mesas, clientes e itens por categoria saem com a unidade; outros números ficam como estão", () => {
    expect(formatFact("faixa_A_mesas", 4)).toBe("4 mesas");
    expect(formatFact("faixa_B_mesas", 1)).toBe("1 mesa");
    expect(formatFact("mesas_total", 15)).toBe("15 mesas");
    expect(formatFact("clientes_semana", 300)).toBe("300 clientes por semana");
    expect(formatFact("itens_bebida", 5)).toBe("5 bebidas");
    expect(formatFact("itens_porcao", 1)).toBe("1 porção");
    expect(formatFact("checkins_tarde_terqui", 42)).toBe("42 check-ins"); // S3: fatos do plano com unidade
    expect(formatFact("convites_A_emitidos", 1)).toBe("1 convite");
    expect(formatFact("segmento_sumiu", 3)).toBe("3 clientes");
    expect(formatFact("ticket_x", 7)).toBe("7");
  });
});

describe("unidade repetida depois do fato (ajuste de 21/11: '160 convites convites')", () => {
  const ctx = { facts: { convites_faixa_B: 160, checkins_faixa_A: 305, uso_faixa_A_pct: 18 } };
  it("tira a unidade repetida, no singular ou no plural, sem mexer no resto", () => {
    expect(renderReferences("teve 9% de uso em {fato:convites_faixa_B} convites: vale testar", ctx)).toBe("teve 9% de uso em 160 convites: vale testar");
    expect(renderReferences("{fato:checkins_faixa_A} check-ins em 30 dias", ctx)).toBe("305 check-ins em 30 dias");
    expect(renderReferences("{fato:convites_faixa_B} convite", ctx)).toBe("160 convites");
  });
  it("palavra diferente depois do fato fica; porcentagem não muda", () => {
    expect(renderReferences("{fato:convites_faixa_B} enviados", ctx)).toBe("160 convites enviados");
    expect(renderReferences("{fato:uso_faixa_A_pct} de uso", ctx)).toBe("18% de uso");
    expect(renderReferences("{fato:uso_faixa_A_pct}%", ctx)).toBe("18%");
  });
});
