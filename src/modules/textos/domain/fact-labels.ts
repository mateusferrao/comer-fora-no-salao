/**
 * Rótulo legível de cada chave de fato (S5.3, "Fatos usados" no "Por que esta oferta?"). Chaves estáveis por apelido
 * do horário vazio (A, B…). S9 (auditoria do Portal 1.6): o dono nunca vê "Faixa A". Quem chama passa o nome do
 * horário por apelido (`slotNames`, ex.: `slotLabel`); sem ele, "Horário vazio A". As bases dos convites dizem a
 * janela de cada uma (37 a 7 dias × últimos 30 dias), para que uma maior que a outra tenha explicação.
 * Chave sem rótulo conhecido → a própria chave com espaços (nunca some).
 */
const DAYS: Record<string, string> = { segqua: "seg a qua", terqui: "ter a qui", sexdom: "sex a dom", fds: "fim de semana" };
const CAT: Record<string, string> = { entrada: "entradas", prato: "pratos", porcao: "porções", sobremesa: "sobremesas", bebida: "bebidas" };

export function factLabel(key: string, slotNames: Readonly<Record<string, string>> = {}): string {
  const slot = (alias: string) => slotNames[alias] ?? `Horário vazio ${alias}`;
  const fx = /^faixa_([A-H])_(intensidade|mesas|turno)$/.exec(key);
  if (fx) return `${slot(fx[1]!)}: ${{ intensidade: "quanto fica vazio", mesas: "mesas a mais que você quer por semana", turno: "turno (almoço, tarde ou noite)" }[fx[2] as "intensidade" | "mesas" | "turno"]}`;
  let m = /^uso7d_([A-H])_pct$/.exec(key);
  if (m) return `${slot(m[1]!)}: % dos convites usados na 1ª semana (entregues de 37 a 7 dias atrás)`;
  m = /^convites7d_([A-H])$/.exec(key);
  if (m) return `${slot(m[1]!)}: convites entregues de 37 a 7 dias atrás (base do %)`;
  m = /^convites_([A-H])_(emitidos|usados_pct)$/.exec(key);
  if (m) return m[2] === "emitidos" ? `${slot(m[1]!)}: convites entregues nos últimos 30 dias` : `${slot(m[1]!)}: % dos convites usados (últimos 30 dias)`;
  m = /^convites_teto_([A-H])$/.exec(key);
  if (m) return `${slot(m[1]!)}: limite semanal de convites`;
  if (/^turno_pouco_\d+$/.test(key)) return "Horário com poucos check-ins (não marcado como vazio)";
  m = /^checkins_([a-z]+)_([a-z]+)$/.exec(key);
  if (m && key !== "checkins_30d") return `Check-ins à ${m[1]}, ${DAYS[m[2]!] ?? m[2]} (30 dias)`;
  m = /^itens_([a-z]+)$/.exec(key);
  if (m) return `Itens no cardápio: ${CAT[m[1]!] ?? m[1]}`;
  const fixed: Record<string, string> = {
    ticket_medio: "Ticket médio que você informou",
    margem_pct: "Margem que você informou",
    mesas_total: "Mesas no salão",
    clientes_semana: "Clientes de salão por semana (estimativa que você informou)",
    checkins_30d: "Check-ins (30 dias)",
    clientes_30d: "Clientes (30 dias)",
    segmento_sumiu: "Clientes que vieram 1 vez e sumiram",
    segmento_perto: "Clientes perto da recompensa da cartela",
    segmento_frequente: "Clientes frequentes (3 ou mais visitas em 30 dias)",
    desconto_maximo_pct: "Desconto máximo permitido",
  };
  return fixed[key] ?? key.replace(/_/g, " ");
}
