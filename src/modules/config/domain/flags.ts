/**
 * Recursos com flag (espec. 4.4, D57): o que não estiver pronto e testado fica desligado. Os 5 foram
 * entregues com testes na S3, então vêm ligados por padrão (D148 [C]); os Bastidores desligam ao vivo.
 */
export const FLAGS = [
  "ab",
  "revisor",
  "aprende",
  "insight_operacao",
  "mcp",
  // S4–S6 (D160, regra de corte): o que não fechar até domingo 22h nasce desligado.
  "login_cliente_email",
  "painel_valor",
  "copy_v2",
  "explica_ia",
  "resumo_email",
  "agendador",
  "modo_garcom",
  "plano_agente",
  "porta_conta",
  // S8 (D270): copiloto e MCP sobre o catálogo; nascem desligados e ligam quando verdes.
  "copiloto",
  "mcp_clientes",
  "mcp_edicao",
  // D252 (candidato: "remove esse limite só pra gente testar"): sem teto diário da chave pública. Nasce desligado.
  "ia_sem_teto",
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
  painel_valor: false,
  copy_v2: false,
  explica_ia: false,
  resumo_email: false,
  agendador: false,
  modo_garcom: false,
  // D225 (candidato): ligado — confiabilidade nas regras vence; a chamada única fica de reserva.
  plano_agente: true,
  porta_conta: false,
  copiloto: false,
  mcp_clientes: false,
  mcp_edicao: false,
  ia_sem_teto: false,
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
  ia_sem_teto: "IA sem teto diário de gasto na chave pública (só para testes; desligue depois)",
};

/** Tarefas com bloco de instruções editável ao vivo (D58): só instruções/tom; schema e regras ficam no código. */
export const PROMPT_TASKS = ["pacote", "plano", "kit", "cardapio"] as const;
export type PromptTask = (typeof PROMPT_TASKS)[number];
export const PROMPT_MAX_CHARS = 1500;
