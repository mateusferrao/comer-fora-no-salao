/**
 * T3 do agente (S6.3b — D159, D191): agente × chamada única no MESMO modelo (vencedor da T3), 5 fixtures × 2
 * repetições, sem reserva (fallback conta como falha), juiz cego fixo em pares (ordem sorteada). Liga `plano_agente`
 * se: regras ok ≥ 90%, p50 ≤ 20 s e juiz "não pior" (vitórias + empates ≥ derrotas). Critério indicativo (n pequeno).
 * Roda à mão (custa crédito): OPENROUTER_KEY_DEMO=... npx tsx eval/run-t3-agente.ts
 * Saída: eval/resultados-t3-agente.json e eval/relatorio-t3-agente.md.
 */
import { writeFileSync } from "node:fs";
import { createOpenRouterGateway } from "@/src/modules/ia/openrouter-gateway";
import { cleanApiKey } from "@/src/modules/ia/gateway-factory";
import { noopTracer } from "@/src/modules/ia/gateway";
import { runTask } from "@/src/modules/ia/run-task";
import { MODELS } from "@/src/modules/ia/models";
import { buildPackageTask, resolveLearned, resolvePackage } from "@/src/modules/ia/tasks/package";
import { AGENT_RULES, buildPlanAgentTask, buildPlanAgentTools, storedSteps } from "@/src/modules/ia/tasks/plan-agent";
import { mulberry32 } from "@/src/shared/rng";
import { hash32 } from "@/src/shared/hash32";
import { systemClock } from "@/src/shared/clock";
import { FIXTURES } from "./fixtures-t3";
import { JUDGE, JUDGE_SYSTEM, judgeSchema } from "./judge-t3";
import { median, prepare, render, show, type Proposal } from "./run-t3";

const REPS = 2;
const PAUSE_MS = 3_000;
const BACKOFF_MS = [5_000, 15_000, 30_000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 429 do OpenRouter é limite de taxa, não falha do modelo: espera e tenta de novo (até 3 vezes). */
const rateLimited = (r: { status: string; attempts: Array<{ detail?: string }> }) => r.status !== "ok" && r.attempts.some((a) => (a.detail ?? "").includes("429"));
async function withRetry<T extends { status: string; attempts: Array<{ detail?: string }> }>(fn: () => Promise<T>): Promise<T & { retries429: number }> {
  let r = await fn();
  let n = 0;
  while (rateLimited(r) && n < BACKOFF_MS.length) {
    await sleep(BACKOFF_MS[n]!);
    n++;
    r = await fn();
  }
  await sleep(PAUSE_MS);
  return Object.assign(r, { retries429: n });
}
const MODEL = MODELS.pacote[0]!;
type Mode = "agente" | "unica";
type Run = { mode: Mode; fixture: string; rep: number; ok: boolean; reason?: string; latencyMs: number; costUsd: number; steps: number; stepLabels: string[]; proposal?: Proposal };

async function main() {
  const key = cleanApiKey(process.env.OPENROUTER_KEY_DEMO);
  if (!key) throw new Error("OPENROUTER_KEY_DEMO ausente");
  const ctx = { gateway: createOpenRouterGateway(key), clock: systemClock, trace: noopTracer };
  const runs: Run[] = [];
  for (const f of FIXTURES) {
    const { cands, facts, pp } = prepare(f);
    for (let rep = 1; rep <= REPS; rep++) {
      for (const mode of ["agente", "unica"] as Mode[]) {
        const task = mode === "agente" ? buildPlanAgentTask(pp, [MODEL], buildPlanAgentTools(pp, cands)) : buildPackageTask(pp, [MODEL]);
        const system = mode === "agente" ? `${pp.system}\n\n${AGENT_RULES}` : pp.system;
        const r = await withRetry(() => runTask(task, system, { text: pp.text }, ctx));
        const latencyMs = r.attempts.reduce((a, x) => a + (x.latencyMs ?? 0), 0);
        const costUsd = r.attempts.reduce((a, x) => a + (x.costUsd ?? 0), 0);
        if (r.status === "ok") {
          const st = storedSteps(r.steps ?? []);
          runs.push({ mode, fixture: f.id, rep, ok: true, latencyMs, costUsd, steps: st.length, stepLabels: st.map((s) => s.label), proposal: render(f, cands, facts, resolvePackage(pp, r.data), resolveLearned(pp, r.data)) });
        } else runs.push({ mode, fixture: f.id, rep, ok: false, reason: `${r.reason}: ${r.attempts.flatMap((a) => a.notes ?? [a.detail ?? ""]).slice(0, 3).join("; ")}`, latencyMs, costUsd, steps: 0, stepLabels: [] });
        process.stdout.write(`${mode} ${f.id} #${rep} ${r.status} ${latencyMs}ms\n`);
      }
    }
  }

  // Juiz cego: agente × chamada única na mesma fixture e repetição (só quando os dois deram certo).
  const judged: Array<{ fixture: string; rep: number; pref: "agente" | "unica" | "empate"; motivo: string; costUsd: number }> = [];
  for (const a of runs.filter((x) => x.mode === "agente" && x.ok)) {
    const u = runs.find((x) => x.mode === "unica" && x.ok && x.fixture === a.fixture && x.rep === a.rep);
    if (!u) continue;
    const f = FIXTURES.find((x) => x.id === a.fixture)!;
    const agentFirst = mulberry32(hash32(`agente:${a.fixture}:${a.rep}`))() < 0.5;
    const [A, B] = agentFirst ? [a.proposal!, u.proposal!] : [u.proposal!, a.proposal!];
    const text = `Restaurante: ${f.restaurantName} (${f.cuisine})\nCardápio: ${f.menu.map((m) => `${m.name} (${m.category})`).join(", ")}\n\nProposta A:\n${show(A)}\n\nProposta B:\n${show(B)}`;
    const r = await withRetry(() => runTask({ name: "juiz-t3-agente", promptVersion: "juiz-t3-v1", models: [JUDGE], schema: judgeSchema, perAttemptTimeoutMs: 60_000, totalBudgetMs: 90_000, maxOutputTokens: 3_000 }, JUDGE_SYSTEM, { text }, ctx));
    const cost = r.attempts.reduce((s, x) => s + (x.costUsd ?? 0), 0);
    if (r.status !== "ok") continue;
    const pref = r.data.preferencia === "empate" ? "empate" : (r.data.preferencia === "A") === agentFirst ? "agente" : "unica";
    judged.push({ fixture: a.fixture, rep: a.rep, pref, motivo: r.data.motivo, costUsd: cost });
    process.stdout.write(`juiz ${a.fixture} #${a.rep} → ${pref}\n`);
  }

  const stat = (mode: Mode) => {
    const rs = runs.filter((x) => x.mode === mode);
    const ok = rs.filter((x) => x.ok);
    return { n: rs.length, ok: ok.length, okPct: rs.length ? ok.length / rs.length : 0, p50: median(ok.map((x) => x.latencyMs)), costPerCall: rs.length ? rs.reduce((s, x) => s + x.costUsd, 0) / rs.length : 0, avgSteps: ok.length ? ok.reduce((s, x) => s + x.steps, 0) / ok.length : 0 };
  };
  const ag = stat("agente");
  const un = stat("unica");
  const wins = judged.filter((j) => j.pref === "agente").length;
  const ties = judged.filter((j) => j.pref === "empate").length;
  const losses = judged.filter((j) => j.pref === "unica").length;
  const notWorse = judged.length > 0 && wins + ties >= losses;
  const turnOn = ag.okPct >= 0.9 && ag.p50 !== null && ag.p50 <= 20_000 && notWorse;
  const totalCost = runs.reduce((s, x) => s + x.costUsd, 0) + judged.reduce((s, x) => s + x.costUsd, 0);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const sec = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`);
  const reasons = runs.filter((x) => !x.ok).map((x) => `- ${x.mode} ${x.fixture} #${x.rep}: ${x.reason}`);
  const md = `# T3 do agente — plano da semana como agente × chamada única (D159, D191)

Rodada de ${new Date().toISOString().slice(0, 10)} · pausa de 3 s entre chamadas e nova tentativa no limite de taxa (429 não conta como falha do modelo; a 1ª rodada do dia perdeu 12 de 20 execuções por 429 e foi descartada) · modelo ${MODEL.id} (vencedor da T3) · ${FIXTURES.length} fixtures fictícias × ${REPS} repetições · sem reserva (falha conta como falha) · juiz cego fixo \`${JUDGE.id}\` em pares (ordem sorteada) · custo total US$ ${totalCost.toFixed(4)}.

| Modo | Passou nas regras | p50 | Custo/chamada | Passos (média) |
|---|---|---|---|---|
| Agente (ferramentas) | ${ag.ok}/${ag.n} (${pct(ag.okPct)}) | ${sec(ag.p50)} | US$ ${ag.costPerCall.toFixed(4)} | ${ag.avgSteps.toFixed(1)} |
| Chamada única | ${un.ok}/${un.n} (${pct(un.okPct)}) | ${sec(un.p50)} | US$ ${un.costPerCall.toFixed(4)} | — |

Juiz (pares agente × única): agente ${wins} · empate ${ties} · única ${losses} → ${notWorse ? "não pior" : "pior"}.

Regra fixada antes da rodada (D159): liga \`plano_agente\` com regras ok ≥ 90%, p50 ≤ 20 s e juiz não pior (vitórias + empates ≥ derrotas).

**Decisão: ${turnOn ? "ligar `plano_agente`" : "manter `plano_agente` desligada"}.**

${reasons.length ? `Falhas:\n${reasons.join("\n")}\n` : ""}
Exemplo de passos do agente: ${runs.find((x) => x.mode === "agente" && x.ok)?.stepLabels.join(" → ") ?? "—"}

## Limitações
- Amostra pequena (${FIXTURES.length} fixtures × ${REPS}); o juiz avalia o texto, não o resultado no salão.
- As fixtures e os fatos são fictícios; o agente tem as mesmas regras e o mesmo schema da chamada única.
`;
  writeFileSync("eval/relatorio-t3-agente.md", md);
  writeFileSync("eval/resultados-t3-agente.json", JSON.stringify({ when: new Date().toISOString(), model: MODEL.id, judge: JUDGE.id, reps: REPS, agente: ag, unica: un, juiz: { wins, ties, losses, notWorse }, turnOn, totalCostUsd: totalCost, runs: runs.map(({ proposal: _p, ...r }) => r), judged }, null, 2));
  process.stdout.write(`\nagente ${pct(ag.okPct)} p50 ${sec(ag.p50)} · única ${pct(un.okPct)} p50 ${sec(un.p50)} · juiz ${wins}/${ties}/${losses} · ligar: ${turnOn} · US$ ${totalCost.toFixed(4)}\n`);
}

void main();
