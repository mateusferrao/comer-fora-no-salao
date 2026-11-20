/**
 * Saída da tarefa de IA 1 (cardápio) e a conferência do código depois dela (planejamento S2 §4.4–4.5):
 * a IA estrutura; o código limpa nomes (eles entram em outros prompts), sinaliza preços implausíveis e
 * duplicados ("confira") e limita a 80 itens. O dono revisa a tabela antes de seguir.
 */
import { z } from "zod";
import { MENU_CATEGORIES, type MenuCategory } from "@/src/modules/beneficios/domain/menu";

export const PRICE_BANDS = ["$", "$$", "$$$", "$$$$"] as const;
export const MAX_MENU_ITEMS = 80;
const MIN_PRICE = 100;
const MAX_PRICE = 100_000;

/** Schema enviado ao modelo: sem limites de tamanho (nem todo provedor aceita no modo estrito); o código limita depois. */
export const rawExtractionSchema = z.object({
  ehCardapio: z.boolean(),
  itens: z.array(z.object({ categoria: z.enum(MENU_CATEGORIES), nome: z.string(), precoCentavos: z.number().int() })),
  culinaria: z.string().nullable(),
  faixaPreco: z.enum(PRICE_BANDS).nullable(),
  parcial: z.boolean(),
});
export type RawExtraction = z.infer<typeof rawExtractionSchema>;

export type ExtractedItem = { categoria: MenuCategory; nome: string; precoCentavos: number; confira: boolean };
export type CleanExtraction = { ehCardapio: boolean; itens: ExtractedItem[]; culinaria: string | null; faixaPreco: (typeof PRICE_BANDS)[number] | null; parcial: boolean };

/** Nome do item como dado: sem caracteres de controle, sem chaves (referências), espaços normalizados, ≤ 80. */
export function cleanItemName(s: string): string {
  return s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[{}<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
}

export function cleanExtraction(raw: RawExtraction): CleanExtraction {
  if (!raw.ehCardapio) return { ehCardapio: false, itens: [], culinaria: null, faixaPreco: null, parcial: false };
  const seen = new Set<string>();
  const itens: ExtractedItem[] = [];
  for (const it of raw.itens) {
    const nome = cleanItemName(it.nome);
    if (!nome) continue;
    const key = `${nome.toLowerCase()}|${it.precoCentavos}`;
    const dup = seen.has(key);
    seen.add(key);
    const implausivel = !Number.isInteger(it.precoCentavos) || it.precoCentavos < MIN_PRICE || it.precoCentavos > MAX_PRICE;
    itens.push({ categoria: it.categoria, nome, precoCentavos: Math.max(0, Math.round(it.precoCentavos)), confira: dup || implausivel });
  }
  const cuisine = raw.culinaria ? cleanItemName(raw.culinaria).slice(0, 40) || null : null;
  return {
    ehCardapio: true,
    itens: itens.slice(0, MAX_MENU_ITEMS),
    culinaria: cuisine,
    faixaPreco: raw.faixaPreco,
    parcial: raw.parcial || itens.length > MAX_MENU_ITEMS,
  };
}
