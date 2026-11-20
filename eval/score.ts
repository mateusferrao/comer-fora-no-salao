/** Pontuação da T1 (D117): F1 de itens (nome normalizado), preço exato e categoria entre os pareados. */
export type Item = { categoria: string; nome: string; precoCentavos: number };

export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): string[] {
  const t = ` ${s} `;
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** Coeficiente de Dice sobre bigramas (0–1). */
export function similarity(a: string, b: string): number {
  const A = bigrams(normName(a));
  const B = bigrams(normName(b));
  if (!A.length || !B.length) return 0;
  const counts = new Map<string, number>();
  for (const x of A) counts.set(x, (counts.get(x) ?? 0) + 1);
  let inter = 0;
  for (const x of B) {
    const c = counts.get(x) ?? 0;
    if (c > 0) {
      inter++;
      counts.set(x, c - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

export type Score = { f1: number; precision: number; recall: number; priceExact: number; category: number; matched: number; expected: number; got: number };

/** Pareamento guloso pela maior similaridade (≥ 0,8), um a um. */
export function score(expected: Item[], got: Item[], threshold = 0.8): Score {
  const pairs: Array<[number, number, number]> = [];
  expected.forEach((e, i) => got.forEach((g, j) => {
    const s = similarity(e.nome, g.nome);
    if (s >= threshold) pairs.push([s, i, j]);
  }));
  pairs.sort((a, b) => b[0] - a[0]);
  const usedE = new Set<number>();
  const usedG = new Set<number>();
  let price = 0;
  let cat = 0;
  for (const [, i, j] of pairs) {
    if (usedE.has(i) || usedG.has(j)) continue;
    usedE.add(i);
    usedG.add(j);
    if (expected[i]!.precoCentavos === got[j]!.precoCentavos) price++;
    if (expected[i]!.categoria === got[j]!.categoria) cat++;
  }
  const m = usedE.size;
  const precision = got.length ? m / got.length : 0;
  const recall = expected.length ? m / expected.length : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { f1, precision, recall, priceExact: m ? price / expected.length : 0, category: m ? cat / m : 0, matched: m, expected: expected.length, got: got.length };
}

/** Nota da T1 [C]: 0,5·preço (sobre o esperado) + 0,4·F1 + 0,1·categoria. */
export function composite(s: Score): number {
  return 0.5 * s.priceExact + 0.4 * s.f1 + 0.1 * s.category;
}
