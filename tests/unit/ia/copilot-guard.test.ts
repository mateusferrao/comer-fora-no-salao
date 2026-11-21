import { describe, expect, it } from "vitest";
import { guardText, CHAT_FORBIDDEN } from "@/src/modules/ia/guardrails";
import { renderReferences, unknownRefs } from "@/src/modules/textos/domain/references";
import { toMessages } from "@/src/modules/ia/openrouter-gateway";

const ctx = {
  facts: { convites_usados_7d: 12, uso_convites_pct: 40 },
  items: { P1: "Cannoli" },
  slots: { F1: "Ter, Qua e Qui · 15h–18h" },
  clientes: { C3: "Ana S." },
};
const chat = (t: string) => guardText(t, ctx, { allowed: ["fato", "prato", "horario", "cliente"], maxLen: 600, field: "chat", mode: "ia", forbidden: CHAT_FORBIDDEN });

describe("referência {cliente} (S8 — D262)", () => {
  it("renderiza o nome curto do código", () => {
    expect(renderReferences("{cliente:C3} está perto da recompensa.", ctx)).toBe("Ana S. está perto da recompensa.");
  });
  it("apelido desconhecido reprova", () => {
    expect(unknownRefs("{cliente:C9} voltou", ctx, ["cliente"])).toEqual(["cliente:C9"]);
  });
});

describe("guard chat (S8 — D264)", () => {
  it("aceita resposta só com referências", () => {
    expect(chat("Nesta semana, {fato:convites_usados_7d} foram usados em {horario:F1}, com {prato:P1}. {cliente:C3} está perto da recompensa.")).toEqual({ ok: true, warnings: [] });
  });
  it("dígito cru reprova", () => {
    const g = chat("Foram 12 convites usados.");
    expect(g.ok).toBe(false);
    expect(!g.ok && g.reasons).toContain("numero");
  });
  it("número por extenso reprova", () => {
    const g = chat("Foram doze convites usados.");
    expect(!g.ok && g.reasons).toContain("numero_extenso:doze");
  });
  it("URL reprova", () => {
    for (const t of ["Veja em https://exemplo.com", "Acesse www.exemplo.com.br", "Entre em promo.site.com agora"]) {
      const g = chat(t);
      expect(!g.ok && g.reasons).toContain("url");
    }
  });
  it("e-mail cru reprova como pii", () => {
    const g = chat("Escreva para ana@exemplo.com");
    expect(!g.ok && g.reasons).toContain("pii");
  });
  it("lista do chat: 'grátis' passa (explicar oferta), 'reais' e 'ifood paga' não", () => {
    expect(chat("O convite dá a sobremesa grátis no horário vazio.").ok).toBe(true);
    expect(!chat("Custa poucos reais.").ok).toBe(true);
    expect(!chat("O ifood paga o convite.").ok).toBe(true);
  });
  it("artigo 'um/uma' não conta como número", () => {
    expect(chat("Você tem um horário vazio com uma oferta boa.").ok).toBe(true);
  });
});

describe("toMessages com conversa (S8)", () => {
  it("mantém a ordem e os papéis", () => {
    expect(toMessages({ messages: [{ role: "user", text: "oi" }, { role: "assistant", text: "olá" }, { role: "user", text: "troca a oferta" }] })).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "olá" },
      { role: "user", content: "troca a oferta" },
    ]);
  });
});
