/** Rótulos da IA para a tela (Qualidade da IA nos Bastidores e "Por que esta oferta?" — S5.3). */
export const TASK: Record<string, string> = { cardapio: "Leitura do cardápio", pacote: "Pacote da ativação", plano: "Plano da semana", plano_agente: "Plano da semana (agente)", kit: "Chamadas do kit", revisor: "Revisor" };
export const REASON: Record<string, string> = {
  invalid: "fora do formato ou reprovado nas regras",
  timeout: "tempo esgotado",
  unavailable: "indisponível",
  sem_chave: "sem chave de IA neste ambiente",
  teto_diario: "limite diário de IA atingido",
  sem_candidatas: "sem opções válidas para escolher",
  erro: "erro inesperado",
  outro: "outro",
};
const FIELD: Record<string, string> = { textoConvite: "texto do convite", justificativa: "justificativa", aprendemos: "o que aprendemos" };
const RULE: Record<string, string> = {
  numero: "número escrito pela IA",
  pii: "dado pessoal",
  formato: "fora do formato",
  vazio: "texto vazio",
  faixa_repetida: "faixa repetida",
  candidata_fora_da_faixa: "opção de outra faixa",
  faixa_sem_escolha: "faixa sem escolha",
  ordem_nao_e_permutacao: "ordem das faixas inválida",
  // D226 (revisão S4–S6, produto 9).
  sem_horario: "convite sem dia e horário",
  artigo_antes_do_horario: "“no/na/em” antes do horário",
  oferta_repetida: "oferta repetida ao lado de {oferta}",
};
export const usd = (x: number, d = 4) => `US$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}`;

/** Nota do guard ("textoConvite:proibida:gratis") → "texto do convite: palavra proibida 'gratis'". */
export function guardNote(note: string): string {
  const parts = note.split(":");
  const field = FIELD[parts[0]!] ? FIELD[parts.shift()!] : null;
  const [rule = "", arg] = parts;
  let text = RULE[rule] ?? rule.replace(/_/g, " ");
  if (rule === "proibida") text = `palavra proibida '${arg ?? ""}'`;
  else if (rule === "evitar") text = arg ? `termo a evitar '${arg}'` : "termo a evitar";
  else if (rule === "referencia") text = "referência desconhecida";
  else if (rule === "tamanho") text = "texto longo demais";
  else if (rule === "dia_turno") text = "dia ou turno que não bate com a faixa";
  else if (rule === "item_do_convite") text = "prato diferente do convite";
  else if (rule.startsWith("aprendemos")) text = "'o que aprendemos' fora da regra";
  return field ? `${field}: ${text}` : text;
}
