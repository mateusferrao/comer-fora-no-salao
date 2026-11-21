/** Por que o plano saiu sem IA (código → frase para o dono e para o assistente via MCP). Um mapa só (Portal e MCP). */
const MOTIVO: Record<string, string> = {
  sem_chave: "a IA está desligada neste ambiente",
  teto_diario: "o limite diário de uso de IA da demonstração foi atingido (volta amanhã)",
  limite: "o limite diário de IA foi atingido",
  timeout: "a IA demorou demais para responder",
  unavailable: "a IA ficou indisponível",
  invalid: "a resposta da IA não passou nas regras",
  sem_candidatas: "faltam ofertas válidas no cardápio para algum horário",
  erro: "houve um erro ao chamar a IA",
};

export function semIaMotivo(reason: string | undefined | null): string | null {
  return reason ? (MOTIVO[reason] ?? "a IA não respondeu") : null;
}
