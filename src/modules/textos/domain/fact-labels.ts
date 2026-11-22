/**
 * Rótulo legível de cada chave de fato (S5.3, "Fatos usados" no "Por que esta oferta?"). Chaves estáveis por apelido
 * de faixa (A, B…). Chave sem rótulo conhecido → a própria chave com espaços (nunca some).
 */
const DAYS: Record<string, string> = { segqua: "seg a qua", terqui: "ter a qui", sexdom: "sex a dom", fds: "fim de semana" };
const CAT: Record<string, string> = { entrada: "entradas", prato: "pratos", porcao: "porções", sobremesa: "sobremesas", bebida: "bebidas" };

export function factLabel(key: string): string {
  const fx = /^faixa_([A-H])_(intensidade|mesas|turno)$/.exec(key);
  if (fx) return { intensidade: `Faixa ${fx[1]}: quanto fica vazia`, mesas: `Faixa ${fx[1]}: mesas a mais que você quer por semana`, turno: `Faixa ${fx[1]}: turno` }[fx[2] as "intensidade" | "mesas" | "turno"];
  let m = /^uso7d_([A-H])_pct$/.exec(key);
  if (m) return `Faixa ${m[1]}: convites usados em até 1 semana`;
  m = /^convites7d_([A-H])$/.exec(key);
  if (m) return `Faixa ${m[1]}: convites com 1 semana completa`;
  m = /^convites_([A-H])_(emitidos|usados_pct)$/.exec(key);
  if (m) return m[2] === "emitidos" ? `Faixa ${m[1]}: convites emitidos (30 dias)` : `Faixa ${m[1]}: convites usados (30 dias)`;
  m = /^checkins_([a-z]+)_([a-z]+)$/.exec(key);
  if (m && key !== "checkins_30d") return `Check-ins à ${m[1]}, ${DAYS[m[2]!] ?? m[2]} (30 dias)`;
  m = /^itens_([a-z]+)$/.exec(key);
  if (m) return `Itens no cardápio: ${CAT[m[1]!] ?? m[1]}`;
  const fixed: Record<string, string> = {
    ticket_medio: "Ticket médio que você declarou",
    margem_pct: "Margem que você declarou",
    mesas_total: "Mesas no salão",
    clientes_semana: "Clientes de salão por semana (estimativa que você declarou)",
    checkins_30d: "Check-ins (30 dias)",
    clientes_30d: "Clientes (30 dias)",
  };
  return fixed[key] ?? key.replace(/_/g, " ");
}
