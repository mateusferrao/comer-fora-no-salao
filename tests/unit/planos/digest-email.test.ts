import { describe, expect, it } from "vitest";
import { digestEmail, type DigestView } from "@/src/modules/planos/domain/digest-email";

const base: DigestView = {
  restaurant: "Cantina Nonna Lucia",
  week: { from: "2026-11-16", to: "2026-11-22" },
  stats: { checkins: 42, validados: 31, convitesUsados: 9 },
  topline: { kind: "antecipado", motivo: "amostra", usados: 9, consumoCents: 81_000, margemCents: 32_400, custoCents: 19_800, faltamControle: 4, faltamConvidados: 0 },
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
    expect(m.text).toContain("Semana de 16/11 a 22/11");
    expect(m.text).toContain("42 check-ins · 31 códigos validados · 9 convites usados");
    expect(m.text).toContain("Estimativa, não causal: parte dessas pessoas voltaria sem convite.");
    expect(m.text).toMatch(/≈ R\$\s?810 em consumo \(R\$\s?324 de margem\) · custo dos convites R\$\s?198/);
    expect(m.text).toContain("Ter, Qua e Qui · 15h–18h: Cannoli grátis · teto 20 convites · custo máximo R$");
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
    const c = digestEmail({ ...base, topline: { kind: "causal_positivo", cents: 123_400, lo: 50_000, hi: 190_000, nT: 120 } });
    expect(c.text).toMatch(/R\$\s?1\.234 a mais em margem entre 120 convidados até agora/);
    const s = digestEmail({ ...base, topline: { kind: "sem_valores", motivo: "amostra", usados: 0, custoCents: 0, faltamControle: 4, faltamConvidados: 2 } });
    expect(s.text).toContain("Nenhum convite usado ainda");
  });

  it("escapa HTML e tira quebra de linha do assunto (injeção de cabeçalho)", () => {
    const m = digestEmail({ ...base, restaurant: "Bar <b>\r\nBcc: x@y" });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.html).not.toContain("<b>");
    expect(m.html).toContain("&lt;b&gt;");
  });
});
