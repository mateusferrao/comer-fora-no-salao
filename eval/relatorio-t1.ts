/**
 * Gera eval/relatorio-t1.md a partir de eval/resultados-t1.json (D117). Regra de escolha [C]:
 * maior nota média nos 3 cardápios fictícios (0,5·preço + 0,4·F1 + 0,1·categoria) com p50 ≤ 15 s;
 * reserva = melhor de OUTRO provedor. A foto real entra como teste de robustez (não decide sozinha).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { T1_MODELS } from "./models-t1";

type Run = { entrant: string; kind: string; menu: string; ok: boolean; latencyMs: number; costUsd: number; nota: number; score: { f1: number; precision: number; priceExact: number; category: number; matched: number; expected: number; got: number } };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function buildReport(data: { promptVersion: string; at: string; runs: Run[] }) {
  const entrants = [...new Set(data.runs.map((r) => r.entrant))];
  const FICT = ["boteco", "burger", "sushi"];
  const rows = entrants.map((e) => {
    const rs = data.runs.filter((r) => r.entrant === e);
    const fict = rs.filter((r) => FICT.includes(r.menu));
    const real = rs.filter((r) => r.menu === "real");
    const byMenu = Object.fromEntries(FICT.concat("real").map((m) => [m, mean(rs.filter((r) => r.menu === m).map((r) => r.nota))]));
    return {
      e,
      kind: rs[0]!.kind,
      provider: T1_MODELS.find((m) => m.label === e)?.provider ?? (e.startsWith("Google") ? "google-vision" : "local"),
      nota: mean(fict.map((r) => r.nota)),
      preco: mean(fict.map((r) => r.score.priceExact)),
      f1: mean(fict.map((r) => r.score.f1)),
      cat: mean(fict.map((r) => r.score.category)),
      valid: fict.filter((r) => r.ok).length / Math.max(1, fict.length),
      p50: median(fict.map((r) => r.latencyMs)) / 1000,
      cost: mean(fict.map((r) => r.costUsd)),
      byMenu,
      realPrecision: mean(real.map((r) => r.score.precision)),
      realInvented: mean(real.map((r) => r.score.got - r.score.matched)),
    };
  });
  // Empate na nota (3 casas) → menor custo por cardápio decide.
  rows.sort((a, b) => Number(b.nota.toFixed(3)) - Number(a.nota.toFixed(3)) || a.cost - b.cost);
  const eligible = rows.filter((r) => r.kind === "visao" && r.p50 <= 15 && !r.e.includes("referência"));
  const winner = eligible[0];
  const backup = eligible.find((r) => r.provider !== winner?.provider);

  const L: string[] = [];
  L.push("# Mini-avaliação T1 — estruturar cardápio (foto/PDF → itens)", "");
  L.push(`Rodada: ${data.at} · prompt \`${data.promptVersion}\` · 2 repetições por cardápio por modelo · gerado por \`eval/relatorio-t1.ts\`.`, "");
  L.push("## Por que medir agora (D117) e o que foi medido", "");
  L.push("- A extração é o momento \"uau\" da ativação. A escolha do modelo sai de número, não de opinião (D51), e o assistente que conduz a avaliação (Claude) é parte interessada: o `claude-haiku-5.5` concorre com o conflito declarado.");
  L.push("- **3 cardápios fictícios com gabarito** (mesma fonte de dados desenha a imagem e o gabarito): `boteco` (foto torta, 2 colunas, ruído), `burger` (limpo, fundo escuro), `sushi` (PDF de 2 páginas convertido em imagens, como o navegador faz — D127). **+1 foto de cardápio impresso** enviada pelo candidato (manuscrita, em ângulo, 338×450, com desenhos; sem dados de clientes), só como teste de robustez e de invenção de itens; fica em `eval/privado/` (fora do produto e da cópia pública) e os resultados guardam só as notas.");
  L.push("- Configuração de cada modelo: esforço de raciocínio no mínimo disponível, provedor ordenado por latência e `data_collection: deny` (revisão T-I4). Tempo-limite de 30 s por tentativa (o mesmo do produto): estourar conta como falha.");
  L.push("- **Linhas de base sem LLM (D128):** Tesseract + regras (OCR local) e Google Vision + regras (OCR em nuvem). **Híbrido:** Google Vision + LLM de texto barato.");
  L.push("- Métricas: preço exato (sobre os itens esperados), F1 de itens (nome normalizado, similaridade ≥ 0,8), categoria certa entre os pareados, JSON válido, latência p50 e custo médio por cardápio. **Nota = 0,5·preço + 0,4·F1 + 0,1·categoria** [C].", "");
  L.push("## Resultado (cardápios fictícios)", "");
  L.push("| Concorrente | Tipo | Nota | Preço exato | F1 itens | Categoria | JSON válido | p50 (s) | Custo/cardápio (US$) |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) L.push(`| ${r.e} | ${r.kind} | ${r.nota.toFixed(3)} | ${pct(r.preco)} | ${pct(r.f1)} | ${pct(r.cat)} | ${pct(r.valid)} | ${r.p50.toFixed(1)} | ${r.cost.toFixed(5)} |`);
  L.push("", "## Nota por cardápio e a foto real", "");
  L.push("| Concorrente | boteco | burger | sushi | foto real (nota) | foto real: itens inventados |");
  L.push("|---|---|---|---|---|---|");
  for (const r of rows) L.push(`| ${r.e} | ${r.byMenu.boteco!.toFixed(2)} | ${r.byMenu.burger!.toFixed(2)} | ${r.byMenu.sushi!.toFixed(2)} | ${r.byMenu.real!.toFixed(2)} | ${r.realInvented.toFixed(1)} |`);
  L.push("", "## Escolha", "");
  if (winner) {
    L.push(`- **Principal: \`${winner.e}\`** — maior nota entre os modelos de visão com p50 ≤ 15 s (a referência mais cara fica fora da escolha).`);
    if (backup) L.push(`- **Reserva: \`${backup.e}\`** — melhor de outro provedor (o laço de reserva troca de provedor quando o principal falha — D53).`);
  }
  const total = data.runs.reduce((a, r) => a + r.costUsd, 0);
  L.push(`- Empate na nota → menor custo por cardápio. Custo total desta rodada: US$ ${total.toFixed(4)} (inclui o preço de tabela do Vision, coberto pela cota grátis).`);
  L.push("- O que a IA acrescenta sobre o OCR clássico está na diferença de nota para as linhas de base: o OCR lê as letras, mas não sabe juntar nome, preço e seção quando o layout é de colunas, foto torta ou manuscrito.");
  return { md: L.join("\n") + "\n", winner: winner?.e, backup: backup?.e };
}

if (process.argv[1]?.endsWith("relatorio-t1.ts")) {
  const data = JSON.parse(readFileSync("eval/resultados-t1.json", "utf8"));
  const r = buildReport(data);
  writeFileSync("eval/relatorio-t1.md", r.md);
  console.log(`principal: ${r.winner} · reserva: ${r.backup}`);
}
