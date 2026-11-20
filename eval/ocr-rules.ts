/**
 * Linha de base "OCR + regras" da T1 (D128): sem IA, só regex sobre o texto do OCR.
 * Seção → categoria por palavra-chave; linha com preço → item; vários preços na linha → um item por tamanho.
 */
import type { Item } from "./score";

const SECTION: Array<[RegExp, string]> = [
  [/petisc|por[cç][oõ]es|para dividir|porcao/i, "porcao"],
  [/entrada|para come[cç]ar|caldo|salada/i, "entrada"],
  [/sobremesa|doce/i, "sobremesa"],
  [/bebida|drink|suco/i, "bebida"],
  [/prato|burger|sushi|sashimi|temaki|combinado|lanche/i, "prato"],
];

const PRICE = /(?:R\$\s*)?(\d{1,4})[,.](\d{2})/g;

export function parseOcr(text: string): Item[] {
  const items: Item[] = [];
  let cat = "prato";
  // OCR de layout em colunas costuma separar nomes e preços em linhas diferentes: nomes sem preço ficam
  // na fila e o próximo preço "solto" vai para o nome mais antigo (melhor esforço sem IA).
  let pending: Array<{ name: string; cat: string }> = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.replace(/[.·…_]{2,}/g, " ").replace(/\s+/g, " ").trim();
    if (!line) continue;
    const prices = [...line.matchAll(PRICE)];
    if (prices.length === 0) {
      const sec = SECTION.find(([re]) => re.test(line) && line.length < 30);
      if (sec) {
        cat = sec[1];
        pending = [];
      } else if (/[a-zà-ú]/i.test(line) && line.length <= 40) pending.push({ name: line, cat });
      continue;
    }
    const first = prices[0]!.index ?? 0;
    const name = line.slice(0, first).replace(/R\$\s*$/, "").replace(/[-–·:]+\s*$/, "").trim();
    if (name.length < 2 && prices.length === 1) {
      const p = pending.shift();
      if (p) items.push({ categoria: p.cat, nome: p.name, precoCentavos: Number(prices[0]![1]) * 100 + Number(prices[0]![2]) });
      continue;
    }
    if (prices.length > 1) {
      // "Chopp claro 300 ml 12,00 · 500 ml 18,00": o rótulo do tamanho fica antes de cada preço.
      const base = name.replace(/\s*\d+\s*ml$/i, "");
      let prevEnd = 0;
      for (const m of prices) {
        const segment = line.slice(prevEnd, m.index).replace(/[·]/g, " ");
        const size = /(\d+\s*ml)\s*$/i.exec(segment.trim())?.[1];
        items.push({ categoria: cat, nome: size ? `${base} ${size}` : base, precoCentavos: Number(m[1]) * 100 + Number(m[2]) });
        prevEnd = (m.index ?? 0) + m[0].length;
      }
    } else if (name.length >= 2) {
      items.push({ categoria: cat, nome: name, precoCentavos: Number(prices[0]![1]) * 100 + Number(prices[0]![2]) });
    }
  }
  return items;
}
