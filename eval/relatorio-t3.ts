/**
 * Relatório da T3 (D137): código (regras, latência, custo, "IA ≠ maior nota"), juiz de IA cego e nota cega do
 * candidato, com concordância (% com intervalo de Wilson e κ de Cohen, indicativo — amostra pequena).
 * Lê eval/resultados-t3.json, eval/t3-cego-chave.json, eval/t3-cego-juiz.json e, se existir,
 * eval/t3-cego-humano.json ({ "respostas": "1A 2B 3empate …" }). Escreve eval/relatorio-t3.md.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

type Pref = "A" | "B" | "empate";
const read = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;

export function parseAnswers(s: string): Map<number, Pref> {
  const m = new Map<number, Pref>();
  for (const x of s.matchAll(/(\d+)\s*(A|B|empate|E)\b/gi)) m.set(Number(x[1]), (/^e/i.test(x[2]!) ? "empate" : x[2]!.toUpperCase()) as Pref);
  return m;
}

export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export function cohenKappa(a: Pref[], b: Pref[]): number | null {
  const n = a.length;
  if (!n) return null;
  const cats: Pref[] = ["A", "B", "empate"];
  const po = a.filter((x, i) => x === b[i]).length / n;
  const pe = cats.reduce((s, c) => s + (a.filter((x) => x === c).length / n) * (b.filter((x) => x === c).length / n), 0);
  return pe === 1 ? null : (po - pe) / (1 - pe);
}

const pct = (x: number) => `${Math.round(100 * x)}%`;
const f2 = (x: number | null | undefined) => (x == null ? "—" : x.toFixed(2).replace(".", ","));

function main() {
  const r = read<{ when: string; judge: string; reps: number; summary: Array<{ model: string; id: string; provider: string; okPct: number; p50Ms: number | null; avgCostUsd: number; differsFromTopPct: number | null; judge: { n: number; item_turno: number | null; fato: number | null; voz: number | null; media: number | null; vitorias: number }; eligible: boolean }>; winner: string | null; reserve: string | null; baseScores: { item_turno: number; fato: number; voz: number } | null; totalCostUsd: number; runs: Array<{ model: string; fixture: string; rep: number; ok: boolean; reason?: string }> }>("eval/resultados-t3.json");
  const key = read<{ winner: string; pairs: Array<{ n: number; fixture: string; ia: "A" | "B" }> }>("eval/t3-cego-chave.json");
  const judge = read<{ judge: string; pairs: Array<{ n: number; pref: Pref; costUsd: number }> }>("eval/t3-cego-juiz.json");
  const human = existsSync("eval/t3-cego-humano.json") ? parseAnswers(read<{ respostas: string }>("eval/t3-cego-humano.json").respostas) : null;
  const side = (n: number, p: Pref) => (p === "empate" ? "empate" : p === key.pairs.find((x) => x.n === n)!.ia ? "IA" : "linha de base");

  const L: string[] = [];
  L.push("# T3 — Pacote e plano da semana: escolha do modelo (D137)", "");
  L.push(`Rodada de ${r.when.slice(0, 10)} · ${r.reps} repetições × 5 fixtures fictícias (eval/fixtures-t3.ts) · juiz fixo e cego: \`${r.judge}\` (não concorre; nunca Anthropic) · custo total US$ ${(r.totalCostUsd + judge.pairs.reduce((a, x) => a + x.costUsd, 0)).toFixed(2).replace(".", ",")}.`, "");
  L.push("## 1. Código (regras, tempo, custo)", "");
  L.push("| Modelo | Passou nas regras | p50 | Custo/chamada | IA ≠ maior nota | Juiz (média 1–5) | Juiz prefere a IA | Elegível |", "|---|---|---|---|---|---|---|---|");
  for (const s of r.summary) L.push(`| ${s.model} | ${pct(s.okPct)} | ${s.p50Ms == null ? "—" : `${(s.p50Ms / 1000).toFixed(1).replace(".", ",")} s`} | US$ ${s.avgCostUsd.toFixed(4).replace(".", ",")} | ${s.differsFromTopPct == null ? "—" : pct(s.differsFromTopPct)} | ${f2(s.judge.media)} (n=${s.judge.n}) | ${s.judge.vitorias}/${s.judge.n} | ${s.eligible ? "sim" : "não"} |`);
  L.push("", "Regra [C] fixada antes da rodada: elegível com regras ok ≥ 90% e p50 ≤ 15 s; vence a maior média do juiz; a reserva é o melhor elegível de outro provedor.", "");
  L.push(`**Vencedor: ${r.winner ?? "nenhum"} · reserva: ${r.reserve ?? "nenhuma"}.**`, "");
  if (r.baseScores) L.push(`Linha de base (sem IA, justificativa modelo do código), nota média do juiz: item × turno ${f2(r.baseScores.item_turno)} · fato ${f2(r.baseScores.fato)} · voz ${f2(r.baseScores.voz)}.`, "");
  const fails = r.runs.filter((x) => !x.ok && x.reason);
  L.push("Motivos de reprovação pelas regras (o modo sem IA cobre todos):", "");
  const by = new Map<string, number>();
  for (const f of fails) for (const m of (f.reason ?? "").replace(/^[^:]+: /, "").split("; ")) by.set(m.replace(/:\d+>\d+/, "").replace(/:[A-H]$/, ""), (by.get(m.replace(/:\d+>\d+/, "").replace(/:[A-H]$/, "")) ?? 0) + 1);
  for (const [m, n] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 8)) L.push(`- \`${m || "tempo esgotado"}\`: ${n}`);
  L.push("");

  L.push("## 2. Juiz de IA × nota cega do candidato (mesmos pares)", "");
  L.push(`${key.pairs.length} pares do vencedor × linha de base (eval/t3-cego.md), ordem A/B sorteada; a chave fica em eval/t3-cego-chave.json.`, "");
  L.push("| Par | Fixture | Juiz | Candidato |", "|---|---|---|---|");
  for (const p of key.pairs) {
    const j = judge.pairs.find((x) => x.n === p.n);
    const h = human?.get(p.n);
    L.push(`| ${p.n} | ${p.fixture} | ${j ? side(p.n, j.pref) : "—"} | ${h ? side(p.n, h) : "aguardando"} |`);
  }
  const jIa = judge.pairs.filter((x) => side(x.n, x.pref) === "IA").length;
  L.push("", `Juiz: prefere a IA em ${jIa} de ${judge.pairs.length} pares.`);
  if (human && human.size) {
    const both = judge.pairs.filter((x) => human.has(x.n));
    const agree = both.filter((x) => human.get(x.n) === x.pref).length;
    const [lo, hi] = wilson(agree, both.length);
    const hIa = [...human].filter(([n, p]) => side(n, p) === "IA").length;
    L.push(`Candidato: prefere a IA em ${hIa} de ${human.size} pares.`);
    L.push(`**Concordância juiz × candidato: ${agree} de ${both.length} (${pct(agree / both.length)}; IC 95% de Wilson ${pct(lo)}–${pct(hi)}) · κ de Cohen ${f2(cohenKappa(both.map((x) => x.pref), both.map((x) => human.get(x.n)!)))} (indicativo: amostra pequena).**`);
  } else L.push("Nota do candidato: aguardando as respostas (`1A 2B 3empate …`).");
  L.push("", "## 3. Limitações", "");
  L.push("- Amostra pequena (5 fixtures × 2 repetições; juiz em n ≤ 5 por modelo): a ordem entre modelos próximos pode mudar de uma rodada para outra. A 1ª rodada (prompt com `{horario:FAIXA}` ambíguo, corrigido para `{horario:X}`) foi descartada; o achado virou correção do prompt (pacote-v2/plano-v2).");
  L.push("- A linha de base é reconhecível pelo texto fixo do convite; o juiz e o candidato podem identificá-la.");
  L.push("- O juiz avalia texto, não resultado: quem decide se a oferta funcionou é o veredito do código com os dados reais.");
  writeFileSync("eval/relatorio-t3.md", L.join("\n") + "\n");
  process.stdout.write("eval/relatorio-t3.md escrito\n");
}

if (process.argv[1]?.endsWith("relatorio-t3.ts")) main();
