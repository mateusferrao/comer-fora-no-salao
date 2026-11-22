import { describe, expect, it } from "vitest";
import { digestEmail, type DigestView } from "@/src/modules/planos/domain/digest-email";

const base: DigestView = {
  restaurant: "Cantina Nonna Lucia",
  week: { from: "2026-11-16", to: "2026-11-22" },
  stats: { checkins: 42, validados: 31, convitesUsados: 9 },
  topline: { kind: "antecipado", motivo: "amostra", usados: 9, consumoCents: 81_000, margemCents: 32_400, custoCents: 19_800, liquidoCents: 12_600, faltamControle: 4, faltamConvidados: 0 },
  plan: {
    slots: [
      { phrase: "Ter, Qua e Qui · 15h–18h", gain: "Cannoli grátis", cap: 20, maxCostCents: 44_000, justificativa: "Tarde com poucos check-ins; sobremesa combina com o café." },
    ],
  },
  links: { aprovar: "https://app.exemplo/parceiro/aprovar/rv_x", portal: "https://app.exemplo/parceiro/salao/plano", parar: "https://app.exemplo/parceiro/resumo/parar?t=abc" },
};

describe("e-mail do resumo semanal (S6.1, D188)", () => {
  it("com plano proposto e aprovação por e-mail: assunto, números do código, topo rotulado, plano e links", () => {
    const m = digestEmail(base);
    expect(m.subject).toBe("Cantina Nonna Lucia: seu plano da semana está pronto para aprovar");
    expect(m.text).toContain("Semana passada (16/11 a 22/11)");
    expect(m.text).toContain("42 check-ins · 31 códigos validados · 9 convites usados");
    // Semana passada × acumulado em blocos separados (S9, auditoria 1.7).
    expect(m.text.indexOf("Até agora, somando todas as semanas")).toBeGreaterThan(m.text.indexOf("42 check-ins"));
    expect(m.text).toContain("Parte desses clientes voltaria mesmo sem convite.");
    expect(m.text).not.toContain("não causal");
    expect(m.text).toMatch(/≈ R\$\s?126 de margem depois de pagar os convites \(consumo R\$\s?810 · margem R\$\s?324 · convites R\$\s?198\)/);
    // A17: o teto conta convites emitidos na semana; o custo máximo é o desses convites.
    expect(m.text).toMatch(/Ter, Qua e Qui · 15h–18h: Cannoli grátis · até 20 convites na semana · custo máximo dos convites emitidos na semana R\$\s?440/);
    expect(m.text).toContain("Revisar e aprovar: https://app.exemplo/parceiro/aprovar/rv_x");
    expect(m.text).toContain("Abrir no Portal: https://app.exemplo/parceiro/salao/plano");
    expect(m.text).toContain("Não quero mais receber este resumo: https://app.exemplo/parceiro/resumo/parar?t=abc");
    expect(m.text).toContain("Protótipo de case · não é produto oficial do iFood");
    expect(m.html).not.toMatch(/<img/);
  });

  it("sem link de aprovação (desligado ou sem plano): 'semana em números' e só o Portal", () => {
    const m = digestEmail({ ...base, links: { ...base.links, aprovar: null } });
    expect(m.subject).toBe("Cantina Nonna Lucia: sua semana em números");
    expect(m.text).not.toContain("Revisar e aprovar");
    const sem = digestEmail({ ...base, plan: null, links: { ...base.links, aprovar: null } });
    expect(sem.text).toContain("Gere o plano da semana no Portal: https://app.exemplo/parceiro/salao/plano");
  });

  it("camada causal e sem valores declarados", () => {
    const c = digestEmail({ ...base, topline: { kind: "causal_positivo", visitas: "positivo", cents: 123_400, lo: 50_000, hi: 190_000, nT: 120 } });
    expect(c.text).toMatch(/R\$\s?1\.234 de margem a mais com os convites, já descontado o custo deles/);
    expect(c.text).toMatch(/Pode ficar entre R\$\s?500 e R\$\s?1\.900/);
    expect(c.subject).toMatch(/^Cantina Nonna Lucia: R\$\s?1\.234 de margem a mais com os convites · plano para aprovar$/);
    const s = digestEmail({ ...base, topline: { kind: "sem_valores", motivo: "amostra", usados: 0, custoCents: 0, faltamControle: 4, faltamConvidados: 2 } });
    expect(s.text).toContain("Nenhum convite usado ainda");
  });

  it("margem negativa com visitas a mais: nunca 'a mais' em reais (A5)", () => {
    const n = digestEmail({ ...base, topline: { kind: "causal_negativo", visitas: "positivo", cents: -20_000, lo: -35_000, hi: -5_000, nT: 120 } });
    expect(n.text).not.toMatch(/a mais em margem|de margem a mais/);
    expect(n.text).toMatch(/Os convites trouxeram visitas a mais, mas custaram R\$\s?200 a mais do que renderam de margem/);
    expect(n.subject).toBe("Cantina Nonna Lucia: seu plano da semana está pronto para aprovar");
  });

  it("intervalo da margem que cruza o zero: diz que ainda não dá para garantir (A5)", () => {
    const z = digestEmail({ ...base, topline: { kind: "causal_cruza_zero", visitas: "positivo", cents: 30_000, lo: -5_000, hi: 65_000, nT: 120 } });
    expect(z.text).not.toMatch(/de margem a mais/);
    expect(z.text).toMatch(/Os convites trouxeram visitas a mais\. Em reais, ainda não dá para garantir lucro: pode ficar entre -R\$\s?50 e R\$\s?650, já descontado o custo dos convites\./);
  });

  it("escapa HTML e tira quebra de linha do assunto (injeção de cabeçalho)", () => {
    const m = digestEmail({ ...base, restaurant: "Bar <b>\r\nBcc: x@y" });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.html).not.toContain("<b>");
    expect(m.html).toContain("&lt;b&gt;");
  });
});
