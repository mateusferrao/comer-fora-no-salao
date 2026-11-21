/**
 * IA roteirizada do copiloto para a E2E local (S8 — revisão técnica I8). Só liga com as TRÊS condições: variável
 * `COPILOT_FAKE_AI=1`, chaves do OpenRouter vazias e o token fictício do servidor local do Playwright. Em produção
 * nenhuma delas vale, e o `/api/health` expõe `fakeAi` para a E2E de produção conferir que está desligada.
 */
import type { AiGateway, AiGenerateRequest } from "@/src/modules/ia/gateway";

export const LOCAL_E2E_TOKEN = "e2e-login-token-ficticio-local-0001";

export function fakeCopilotEnabled(env: Record<string, string | undefined>): boolean {
  return env.COPILOT_FAKE_AI === "1" && !env.OPENROUTER_KEY_PUBLIC && !env.OPENROUTER_KEY_DEMO && env.E2E_LOGIN_TOKEN === LOCAL_E2E_TOKEN;
}

const EMPTY = { papel: null, faixa: null, prato: null, tipo: null, pct: null, teto: null, texto: null, mudanca: null, preco_centavos: null, dias: null, inicio: null, fim: null, intensidade: null, mesas: null };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lê o contexto do prompt (apelidos do cardápio e das faixas) e responde por palavras do pedido. */
export function fakeCopilotGateway(): AiGateway {
  return {
    async generate(req: AiGenerateRequest) {
      // "Seu salão" por frase (E2E): saída fixa; o código descarta o que não estiver no texto.
      if (req.system.startsWith("Você lê a descrição")) {
        const output = { nome: null, mesas: 12, clientes_semana: 300, funcionamento: [{ dias: [2, 3, 4, 5, 6, 0], inicio: "11:00", fim: "23:00" }], faixas: [{ dias: [2, 3], inicio: "15:00", fim: "18:00", intensidade: "muito", mesas_a_mais: 4 }], ticket_reais: 85, margem_pct: null };
        return { output, usage: { inTokens: 0, outTokens: 0, costUsd: 0 }, model: req.model.id, steps: [] };
      }
      const last = "messages" in req.input ? (req.input.messages.at(-1)?.text ?? "") : "";
      const q = norm(last);
      const menu = [...req.system.matchAll(/^- (P\d+): (.+?) \((\w+), [^;)]*(?:; ([^)]*))?\)$/gm)].map((m) => ({ alias: m[1]!, name: m[2]!, cat: m[3]!, flags: m[4] ?? "" }));
      const slotA = /^- A: .*convite: \w+ com (P\d+)/m.exec(req.system);
      let output: unknown = { resposta: "No último mês foram {fato:checkins_30d}.", propostas: [], sugestoes: ["Trocar a oferta do convite"] };
      if (q.includes("oferta") && slotA) {
        const pick = menu.find((m) => m.cat === "sobremesa" && m.alias !== slotA[1] && !m.flags.includes("fora")) ?? menu.find((m) => m.cat === "entrada");
        if (pick) output = { resposta: "Preparei a proposta abaixo para {horario:A}. Confira e aplique se estiver certo.", propostas: [{ ...EMPTY, acao: "oferta", papel: "convite", faixa: "A", prato: pick.alias, tipo: pick.cat === "sobremesa" ? "doce_gratis" : "entrada_gratis" }], sugestoes: ["Mudar o teto desse horário"] };
      } else if (q.includes("acabou")) {
        const it = menu.find((m) => q.includes(norm(m.name)));
        if (it) output = { resposta: "Preparei a proposta abaixo.", propostas: [{ ...EMPTY, acao: "item", prato: it.alias, mudanca: "indisponivel" }], sugestoes: [] };
      }
      return { output, usage: { inTokens: 0, outTokens: 0, costUsd: 0 }, model: req.model.id, steps: [] };
    },
  };
}
