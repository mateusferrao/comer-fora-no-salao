/**
 * Atalhos do modo sem IA (S8 — D271): o código lê palavras do pedido e aponta a aba certa das Configurações.
 * Sem pedido reconhecido, mostra as abas mais usadas.
 */
export type Shortcut = { label: string; href: string };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const RULES: Array<{ words: string[]; s: Shortcut }> = [
  { words: ["convite", "teto", "horario vazio", "faixa", "tarde", "noite", "almoco"], s: { label: "Horários vazios e convites", href: "/parceiro/salao/configuracoes?aba=convites" } },
  { words: ["cardapio", "prato", "acabou", "preco", "item"], s: { label: "Cardápio", href: "/parceiro/salao/configuracoes?aba=cardapio" } },
  { words: ["primeira visita", "1a visita", "agora", "beneficio"], s: { label: "Benefício agora", href: "/parceiro/salao/configuracoes?aba=agora" } },
  { words: ["cartela", "selo", "recompensa"], s: { label: "Cartela", href: "/parceiro/salao/configuracoes?aba=cartela" } },
  { words: ["plano", "aprovar"], s: { label: "Plano da semana", href: "/parceiro/salao/plano" } },
  { words: ["cliente"], s: { label: "Clientes", href: "/parceiro/salao/clientes" } },
  { words: ["tom", "texto", "ia"], s: { label: "IA do restaurante", href: "/parceiro/salao/configuracoes?aba=ia" } },
  { words: ["aviso", "e-mail", "email", "resumo"], s: { label: "Avisos e automação", href: "/parceiro/salao/configuracoes?aba=avisos" } },
];

export function shortcutsFor(text: string): Shortcut[] {
  const n = norm(text);
  const hit = RULES.filter((r) => r.words.some((w) => n.includes(w))).map((r) => r.s);
  return (hit.length ? hit : [RULES[0]!.s, RULES[1]!.s, RULES[4]!.s]).slice(0, 3);
}
