/**
 * Mini-avaliação T3 — pacote e plano da semana (D137; planejamento S3 §6.4). Roda à mão (custa crédito; fora do CI):
 *   OPENROUTER_KEY_DEMO=... npx tsx eval/run-t3.ts
 * 5 fixtures × 6 modelos de texto × 2 repetições, comparados à linha de base sem IA (maior nota + textos-modelo).
 * Camadas: (1) código: JSON + regras ok, "IA ≠ maior nota", p50, custo; (2) juiz de IA cego e FIXO (provedor que não
 * concorre, nunca Anthropic), em pares IA × linha de base com ordem sorteada; (3) arquivo cego para a nota humana.
 * Saída: eval/resultados-t3.json, eval/relatorio-t3.md, eval/t3-cego.md (+ eval/t3-cego-chave.json).
 */
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { createOpenRouterGateway } from "@/src/modules/ia/openrouter-gateway";
import { cleanApiKey } from "@/src/modules/ia/gateway-factory";
import { noopTracer, type ModelRef } from "@/src/modules/ia/gateway";
import { runTask } from "@/src/modules/ia/run-task";
import { buildPackagePrompt, buildPackageTask, resolveLearned, resolvePackage, type PackagePrompt } from "@/src/modules/ia/tasks/package";
import { describeOffer } from "@/src/modules/beneficios/domain/offers";
import { buildCandidates, fallbackChoices, type SlotCandidates } from "@/src/modules/onboarding/domain/candidates";
import { declaredFacts } from "@/src/modules/onboarding/domain/facts";
import { slotAliases, slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import { justificationTemplate, learnedTemplate } from "@/src/modules/planos/domain/plan-facts";
import { renderReferences } from "@/src/modules/textos/domain/references";
import { mulberry32 } from "@/src/shared/rng";
import { hash32 } from "@/src/shared/hash32";
import { systemClock } from "@/src/shared/clock";
import { FIXTURES, type Fixture } from "./fixtures-t3";
import { JUDGE, JUDGE_SYSTEM, judgeSchema } from "./judge-t3";

const REPS = 2;
export const T3_MODELS: Array<{ label: string; provider: string; ref: ModelRef }> = [
  { label: "gemini-3.1-flash-lite", provider: "google", ref: { id: "google/gemini-3.1-flash-lite", provider: "google", sort: "latency", reasoningEffort: "minimal" } },
  { label: "gpt-6-luna", provider: "openai", ref: { id: "openai/gpt-6-luna", provider: "openai", sort: "latency", reasoningEffort: "none" } },
  { label: "deepseek-v4.1-flash", provider: "deepseek", ref: { id: "deepseek/deepseek-v4.1-flash", provider: "deepseek", sort: "latency", reasoningEffort: "none" } },
  { label: "claude-haiku-5.5 (conflito declarado)", provider: "anthropic", ref: { id: "anthropic/claude-haiku-5.5", provider: "anthropic", sort: "latency", reasoningEffort: "none" } },
  { label: "qwen3.8-flash", provider: "qwen", ref: { id: "qwen/qwen3.8-flash", provider: "qwen", sort: "latency" } },
  { label: "gemini-3.8-flash (referência)", provider: "google", ref: { id: "google/gemini-3.8-flash", provider: "google", sort: "latency", reasoningEffort: "low" } },
];
const FALLBACK = "Volte {horario} e aproveite {oferta}.";

type Proposal = { slots: Array<{ phrase: string; offer: string; convite: string; porque: string }>; aprendemos: string[] };
type Run = { model: string; provider: string; fixture: string; rep: number; ok: boolean; reason?: string; latencyMs: number; costUsd: number; differsFromTop: number; slots: number; proposal?: Proposal };
type Judged = { model: string; fixture: string; ai: Rubric; base: Rubric; pref: "ia" | "base" | "empate"; motivo: string; costUsd: number };
type Rubric = { item_turno: number; fato: number; voz: number };

function prepare(f: Fixture) {
  const cands: SlotCandidates[] = buildCandidates(f.slots, f.menu, { ticketCents: f.declared.ticketCents, marginPct: f.declared.marginPct, exclude: f.exclude });
  const facts = { ...declaredFacts(f.declared, f.slots, f.menu), ...(f.extraFacts ?? {}) };
  const pp = buildPackagePrompt({ restaurantName: f.restaurantName, cuisine: f.cuisine, slots: f.slots, cands, menu: f.menu, facts, learned: f.learned });
  return { cands, facts, pp };
}

function render(f: Fixture, cands: SlotCandidates[], facts: Record<string, number | string>, choices: Array<{ slotId: string; candidateId: string; textoConvite: string; justificativa: string }>, learned: Array<{ texto: string; ofertaKey: string }>): Proposal {
  const items = Object.fromEntries(f.menu.map((m) => [m.id, m.name]));
  const slots = Object.fromEntries(f.slots.map((s) => [s.id, slotPhrase(s)]));
  return {
    slots: choices.map((c) => {
      const o = cands.find((x) => x.slotId === c.slotId)?.options.find((x) => x.id === c.candidateId);
      const d = o ? describeOffer(o.offer, f.menu, "convite") : null;
      const ctx = { facts, items, slots, oferta: d?.gain };
      return { phrase: slots[c.slotId] ?? "", offer: d ? `${d.title}: ${d.gain}` : "?", convite: renderReferences(c.textoConvite, ctx), porque: renderReferences(c.justificativa, ctx) };
    }),
    aprendemos: learned.map((l) => {
      const li = f.learned?.find((x) => x.key === l.ofertaKey);
      return renderReferences(l.texto, { facts, items, slots, oferta: li?.gain });
    }),
  };
}

function baseline(f: Fixture, cands: SlotCandidates[], facts: Record<string, number | string>): Proposal {
  const alias = new Map(slotAliases(f.slots).map((a) => [a.slot.id, a.alias]));
  const choices = fallbackChoices(f.slots, cands).map((c) => ({ ...c, textoConvite: FALLBACK.replace("{horario}", `{horario:${c.slotId}}`), justificativa: justificationTemplate(alias.get(c.slotId) ?? "A", c.slotId, facts) }));
  const learned = (f.learned ?? []).map((l) => ({ ofertaKey: l.key, texto: learnedTemplate(l.verdict, alias.get(l.slotId) ?? "A", l.slotId) }));
  return render(f, cands, facts, choices, learned);
}

const show = (p: Proposal) =>
  [...p.slots.map((s, i) => `  Horário ${i + 1} (${s.phrase}) — oferta: ${s.offer}\n    Convite ao cliente: "${s.convite}"\n    Justificativa ao dono: "${s.porque}"`), ...(p.aprendemos.length ? ["  O que aprendemos (semana anterior):", ...p.aprendemos.map((a) => `    - "${a}"`)] : [])].join("\n");

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

async function main() {
  const key = cleanApiKey(process.env.OPENROUTER_KEY_DEMO);
  if (!key) throw new Error("OPENROUTER_KEY_DEMO ausente");
  const gateway = createOpenRouterGateway(key);
  const ctx = { gateway, clock: systemClock, trace: noopTracer };
  const runs: Run[] = [];
  const prepared = new Map(FIXTURES.map((f) => [f.id, prepare(f)]));

  for (const m of T3_MODELS) {
    for (const f of FIXTURES) {
      const { cands, facts, pp } = prepared.get(f.id)!;
      for (let rep = 1; rep <= REPS; rep++) {
        const r = await runTask(buildPackageTask(pp as PackagePrompt, [m.ref]), pp.system, { text: pp.text }, ctx);
        const latencyMs = r.attempts.reduce((a, x) => a + (x.latencyMs ?? 0), 0);
        const costUsd = r.attempts.reduce((a, x) => a + (x.costUsd ?? 0), 0);
        if (r.status === "ok") {
          const choices = resolvePackage(pp, r.data);
          const learned = resolveLearned(pp, r.data);
          const differs = choices.filter((c) => c.candidateId !== cands.find((x) => x.slotId === c.slotId)?.options[0]?.id).length;
          runs.push({ model: m.label, provider: m.provider, fixture: f.id, rep, ok: true, latencyMs, costUsd, differsFromTop: differs, slots: choices.length, proposal: render(f, cands, facts, choices, learned) });
        } else runs.push({ model: m.label, provider: m.provider, fixture: f.id, rep, ok: false, reason: `${r.reason}: ${r.attempts.flatMap((a) => a.notes ?? []).slice(0, 3).join("; ")}`, latencyMs, costUsd, differsFromTop: 0, slots: 0 });
        process.stdout.write(`${m.label} ${f.id} #${rep} ${r.status} ${latencyMs}ms\n`);
      }
    }
  }

  // Juiz cego fixo: só a 1ª repetição de cada modelo × fixture (custo), ordem A/B sorteada por semente fixa.
  const judged: Judged[] = [];
  for (const run of runs.filter((x) => x.ok && x.rep === 1)) {
    const f = FIXTURES.find((x) => x.id === run.fixture)!;
    const { cands, facts } = prepared.get(f.id)!;
    const base = baseline(f, cands, facts);
    const aiFirst = mulberry32(hash32(`${run.model}:${run.fixture}`))() < 0.5;
    const [A, B] = aiFirst ? [run.proposal!, base] : [base, run.proposal!];
    const text = `Restaurante: ${f.restaurantName} (${f.cuisine})\nCardápio: ${f.menu.map((m) => `${m.name} (${m.category})`).join(", ")}\n\nProposta A:\n${show(A)}\n\nProposta B:\n${show(B)}`;
    const task = { name: "juiz-t3", promptVersion: "juiz-t3-v1", models: [JUDGE], schema: judgeSchema, perAttemptTimeoutMs: 60_000, totalBudgetMs: 90_000, maxOutputTokens: 3_000 };
    const r = await runTask(task, JUDGE_SYSTEM, { text }, ctx);
    const cost = r.attempts.reduce((a, x) => a + (x.costUsd ?? 0), 0);
    if (r.status !== "ok") {
      process.stdout.write(`juiz falhou ${run.model} ${run.fixture}\n`);
      continue;
    }
    const d = r.data;
    const ai = aiFirst ? d.A : d.B;
    const bs = aiFirst ? d.B : d.A;
    const pref = d.preferencia === "empate" ? "empate" : (d.preferencia === "A") === aiFirst ? "ia" : "base";
    judged.push({ model: run.model, fixture: run.fixture, ai, base: bs, pref, motivo: d.motivo, costUsd: cost });
    process.stdout.write(`juiz ${run.model} ${run.fixture} → ${pref}\n`);
  }

  // Agregados e regra de escolha [C]: elegível se regras ok ≥ 90% e p50 ≤ 15 s; vence a maior média do juiz.
  const summary = T3_MODELS.map((m) => {
    const rs = runs.filter((x) => x.model === m.label);
    const js = judged.filter((x) => x.model === m.label);
    const mean = (k: keyof Rubric) => (js.length ? js.reduce((a, x) => a + x.ai[k], 0) / js.length : null);
    const avg = js.length ? (js.reduce((a, x) => a + x.ai.item_turno + x.ai.fato + x.ai.voz, 0) / (3 * js.length)) : null;
    const p50 = median(rs.filter((x) => x.ok).map((x) => x.latencyMs));
    const okPct = rs.length ? rs.filter((x) => x.ok).length / rs.length : 0;
    const slots = rs.reduce((a, x) => a + x.slots, 0);
    return {
      model: m.label,
      provider: m.provider,
      id: m.ref.id,
      okPct,
      p50Ms: p50,
      avgCostUsd: rs.length ? rs.reduce((a, x) => a + x.costUsd, 0) / rs.length : 0,
      differsFromTopPct: slots ? rs.reduce((a, x) => a + x.differsFromTop, 0) / slots : null,
      judge: { n: js.length, item_turno: mean("item_turno"), fato: mean("fato"), voz: mean("voz"), media: avg, vitorias: js.filter((x) => x.pref === "ia").length, empates: js.filter((x) => x.pref === "empate").length },
      eligible: okPct >= 0.9 && p50 !== null && p50 <= 15_000,
    };
  });
  const eligible = summary.filter((s) => s.eligible && s.judge.media !== null).sort((a, b) => b.judge.media! - a.judge.media! || a.avgCostUsd - b.avgCostUsd);
  const winner = eligible[0] ?? null;
  const reserve = winner ? (eligible.find((s) => s.provider !== winner.provider) ?? null) : null;
  const baseScores = judged.length ? { item_turno: judged.reduce((a, x) => a + x.base.item_turno, 0) / judged.length, fato: judged.reduce((a, x) => a + x.base.fato, 0) / judged.length, voz: judged.reduce((a, x) => a + x.base.voz, 0) / judged.length } : null;

  // Arquivo cego para a nota humana: 10 pares (vencedor × linha de base, 5 fixtures × 2 repetições), ordem sorteada.
  const pairs: Array<{ n: number; fixture: string; aiFirst: boolean }> = [];
  const lines: string[] = ["# T3 — avaliação cega (nota humana)", "", "Para cada par, diga qual proposta você prefere (A, B ou empate), pensando em: a oferta combina com o horário? a justificativa convence o dono? o convite soa bem?", "Responda no chat assim: `1A 2B 3empate …`. Não abra `t3-cego-chave.json` antes de responder.", ""];
  if (winner) {
    let n = 0;
    for (const f of FIXTURES) {
      const { cands, facts } = prepared.get(f.id)!;
      const base = baseline(f, cands, facts);
      for (const run of runs.filter((x) => x.model === winner.model && x.fixture === f.id && x.ok)) {
        n++;
        const aiFirst = mulberry32(hash32(`cego:${f.id}:${run.rep}`))() < 0.5;
        const [A, B] = aiFirst ? [run.proposal!, base] : [base, run.proposal!];
        pairs.push({ n, fixture: f.id, aiFirst });
        lines.push(`## Par ${n} — ${f.restaurantName} (${f.cuisine})`, "", "**Proposta A**", "", "```", show(A), "```", "", "**Proposta B**", "", "```", show(B), "```", "");
      }
    }
  }
  writeFileSync("eval/t3-cego.md", lines.join("\n"));
  writeFileSync("eval/t3-cego-chave.json", JSON.stringify({ winner: winner?.model ?? null, pairs: pairs.map((p) => ({ n: p.n, fixture: p.fixture, ia: p.aiFirst ? "A" : "B" })) }, null, 2));
  const totalCost = runs.reduce((a, x) => a + x.costUsd, 0) + judged.reduce((a, x) => a + x.costUsd, 0);
  writeFileSync("eval/resultados-t3.json", JSON.stringify({ when: new Date().toISOString(), judge: JUDGE.id, reps: REPS, fixtures: FIXTURES.map((f) => ({ id: f.id, nota: f.nota })), summary, winner: winner?.model ?? null, reserve: reserve?.model ?? null, baseScores, totalCostUsd: totalCost, runs: runs.map(({ proposal: _p, ...r }) => r), judged }, null, 2));
  process.stdout.write(`\nvencedor: ${winner?.model ?? "nenhum"} · reserva: ${reserve?.model ?? "nenhuma"} · custo US$ ${totalCost.toFixed(4)}\n`);
}

void main();
