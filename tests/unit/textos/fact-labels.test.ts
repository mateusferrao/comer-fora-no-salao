import { describe, expect, it } from "vitest";
import { factLabel } from "@/src/modules/textos/domain/fact-labels";

describe("rótulos dos fatos (S5.3; S9: auditoria do Portal 1.6)", () => {
  it("com o nome do horário, o rótulo usa o horário legível no lugar do apelido", () => {
    const names = { A: "ter a qui · 15h–18h" };
    expect(factLabel("uso7d_A_pct", names)).toBe("ter a qui · 15h–18h: % dos convites usados na 1ª semana (entregues de 37 a 7 dias atrás)");
    expect(factLabel("faixa_A_mesas", names)).toBe("ter a qui · 15h–18h: mesas a mais que você quer por semana");
  });

  it("sem o nome, 'Horário vazio A' (nunca 'Faixa A')", () => {
    expect(factLabel("faixa_B_intensidade")).toBe("Horário vazio B: quanto fica vazio");
    expect(factLabel("uso7d_A_pct")).not.toMatch(/Faixa/);
  });

  it("as duas bases de convites dizem a janela de cada uma: uma pode ser maior que a outra", () => {
    expect(factLabel("convites7d_A")).toBe("Horário vazio A: convites entregues de 37 a 7 dias atrás (base do %)");
    expect(factLabel("convites_A_emitidos")).toBe("Horário vazio A: convites entregues nos últimos 30 dias");
  });

  it("fatos que antes caíam no nome cru ganham rótulo", () => {
    expect(factLabel("segmento_sumiu")).toBe("Clientes que vieram 1 vez e sumiram");
    expect(factLabel("segmento_perto")).toBe("Clientes perto da recompensa da cartela");
    expect(factLabel("segmento_frequente")).toBe("Clientes frequentes (3 ou mais visitas em 30 dias)");
    expect(factLabel("turno_pouco_1")).toBe("Horário com poucos check-ins (não marcado como vazio)");
    expect(factLabel("desconto_maximo_pct")).toBe("Desconto máximo permitido");
    expect(factLabel("convites_teto_A", { A: "ter a qui · 15h–18h" })).toBe("ter a qui · 15h–18h: teto semanal de convites");
  });

  it("chave desconhecida continua aparecendo (com espaços)", () => {
    expect(factLabel("algo_novo")).toBe("algo novo");
  });
});
