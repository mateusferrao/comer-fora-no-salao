/**
 * Recursos com flag (espec. 4.4, D57): o que não estiver pronto e testado fica desligado. Os 5 foram
 * entregues com testes na S3, então vêm ligados por padrão (D148 [C]); os Bastidores desligam ao vivo.
 */
export const FLAGS = ["ab", "revisor", "aprende", "insight_operacao", "mcp"] as const;
export type Flag = (typeof FLAGS)[number];
export type Flags = Record<Flag, boolean>;
export const FLAG_DEFAULTS: Flags = { ab: true, revisor: true, aprende: true, insight_operacao: true, mcp: true };
export const FLAG_LABEL: Record<Flag, string> = {
  ab: "A/B das peças (status e 'promover vencedora')",
  revisor: "Revisor de IA (outro provedor) no kit e no plano",
  aprende: "Aprende com o dono (edições viram exemplos no prompt do próprio restaurante)",
  insight_operacao: "Insight de operação (alertas de peça, teto e validação)",
  mcp: "Servidor MCP (agente lê e aprova o plano com o token do dono)",
};

/** Tarefas com bloco de instruções editável ao vivo (D58): só instruções/tom; schema e regras ficam no código. */
export const PROMPT_TASKS = ["pacote", "plano", "kit", "cardapio"] as const;
export type PromptTask = (typeof PROMPT_TASKS)[number];
export const PROMPT_MAX_CHARS = 1500;
