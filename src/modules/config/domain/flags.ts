/**
 * Recursos com flag (espec. 4.4, D57): o que não estiver pronto e testado fica desligado. O que foi entregue com
 * testes vem ligado por padrão (D148 [C] na S3; S9 para S4–S8); os Bastidores desligam ao vivo.
 */
export const FLAGS = [
  "ab",
  "revisor",
  "aprende",
  "insight_operacao",
  "mcp",
  // S4–S6 (D160, regra de corte): nasceram desligadas; ligadas por padrão na S9 depois de verdes em produção.
  "login_cliente_email",
  "painel_valor",
  "copy_v2",
  "explica_ia",
  "resumo_email",
  "agendador",
  "modo_garcom",
  "plano_agente",
  "porta_conta",
  // S8 (D270): copiloto e MCP sobre o catálogo; nasceram desligados, ligados por padrão na S9.
  "copiloto",
  "mcp_clientes",
  "mcp_edicao",
] as const;
export type Flag = (typeof FLAGS)[number];
export type Flags = Record<Flag, boolean>;
export const FLAG_DEFAULTS: Flags = {
  ab: true,
  revisor: true,
  aprende: true,
  insight_operacao: true,
  mcp: true,
  login_cliente_email: true,
  // S9 (revisão de requisitos A3): o que foi entregue, testado e está ligado em produção vem ligado no código,
  // para um banco novo ser o mesmo produto do ar. Os Bastidores continuam desligando ao vivo.
  painel_valor: true,
  copy_v2: true,
  explica_ia: true,
  resumo_email: true,
  // Envio automático (segunda 08:30) gasta IA e manda e-mail sozinho: só liga por decisão explícita nos Bastidores.
  agendador: false,
  modo_garcom: true,
  // D225 (candidato): ligado — confiabilidade nas regras vence; a chamada única fica de reserva.
  plano_agente: true,
  porta_conta: true,
  copiloto: true,
  mcp_clientes: true,
  mcp_edicao: true,
};
export const FLAG_LABEL: Record<Flag, string> = {
  ab: "A/B das peças (status e 'promover vencedora')",
  revisor: "Revisor de IA (outro provedor) no kit e no plano",
  aprende: "Aprende com o dono (edições viram exemplos no prompt do próprio restaurante)",
  insight_operacao: "Insight de operação (alertas de peça, teto e validação)",
  mcp: "Servidor MCP (agente lê e aprova o plano com o token do dono)",
  login_cliente_email: "Login do cliente com código por e-mail (desligado: entra sem código, saída de emergência se o e-mail falhar)",
  painel_valor: "Painel em reais, meta e 'Hoje no salão' (S5)",
  copy_v2: "Landing e página do QR reescritas (S5)",
  explica_ia: "'Por que esta oferta?' no plano e no pacote (S5)",
  resumo_email: "Resumo semanal do dono por e-mail com 'Revisar e aprovar' (S6)",
  agendador: "Envio automático do resumo (segunda 08:30) e do lembrete do convite (S6)",
  modo_garcom: "Link do garçom só com 'Validar código' (S6)",
  plano_agente: "Plano da semana como agente com ferramentas (S6; ligado pela D225, com a chamada única de reserva)",
  porta_conta: "Peça porta-conta no kit (S6)",
  copiloto: "Assistente do salão no Portal: pedidos viram propostas que o dono aplica (S8)",
  mcp_clientes: "MCP: agente vê clientes por nome curto, sem contato (S8)",
  mcp_edicao: "MCP: agente propõe e aplica mudanças nas Configurações (S8)",
};

/** Tarefas com bloco de instruções editável ao vivo (D58): só instruções/tom; schema e regras ficam no código. */
export const PROMPT_TASKS = ["pacote", "plano", "kit", "cardapio"] as const;
export type PromptTask = (typeof PROMPT_TASKS)[number];
export const PROMPT_MAX_CHARS = 1500;
