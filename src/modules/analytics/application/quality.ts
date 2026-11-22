/**
 * Qualidade da IA (espec. 2, 4.8; planejamento S3 §4.7): só agregados, sem conteúdo nem dados pessoais. Fora as
 * contas e o restaurante dos testes automáticos (E2E).
 */
import { sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";

export type TaskQuality = { task: string; calls: number; okPct: number; fallbackByReason: Record<string, number>; reservePct: number; costUsd: number; avgCostUsd: number; p50Ms: number | null; topBlocks: Array<{ reason: string; n: number }> };
export type QualityView = {
  tasks: TaskQuality[];
  acceptedNoEdit: Array<{ what: string; accepted: number; total: number }>;
  aiVsTop: { compared: number; differs: number };
  totalCostUsd: number;
};

type Row = Record<string, unknown>;
const q = async (ex: Executor, s: ReturnType<typeof sql>): Promise<Row[]> => ((await ex.execute(s)) as unknown as { rows: Row[] }).rows;
// Exclui o E2E: restaurantes de contas `via=e2e` e o restaurante E2E protegido.
const E2E_RESTAURANTS = sql`(select r.id from restaurants r join owners o on o.id = r.owner_id where o.via = 'e2e' or (r.protected and r.kind = 'teste'))`;
const NOT_E2E = sql`(a.restaurant_id is null or a.restaurant_id not in ${E2E_RESTAURANTS})`;

export async function getQualityView(ex: Executor): Promise<QualityView> {
  const base = await q(
    ex,
    sql`select a.task, count(*)::int calls, count(*) filter (where a.status = 'ok')::int ok,
          coalesce(sum(a.cost_usd), 0)::float cost,
          percentile_cont(0.5) within group (order by a.latency_ms) p50,
          count(*) filter (where a.status = 'ok' and jsonb_array_length(a.attempts) > 1)::int reserve
        from ai_calls a where ${NOT_E2E} and a.task not like 'teste:%' group by a.task order by a.task`,
  );
  const reasons = await q(ex, sql`select a.task, coalesce(a.reason, 'outro') reason, count(*)::int n from ai_calls a where ${NOT_E2E} and a.status <> 'ok' and a.task not like 'teste:%' group by 1, 2`);
  const blocks = await q(
    ex,
    sql`select a.task, regexp_replace(n.note, ':.*$', '') reason, count(*)::int n
        from ai_calls a, jsonb_array_elements(a.attempts) att, jsonb_array_elements_text(coalesce(att->'notes', '[]'::jsonb)) n(note)
        where ${NOT_E2E} and a.task not like 'teste:%' group by 1, 2 order by 3 desc`,
  );
  const tasks: TaskQuality[] = base.map((b) => {
    const calls = Number(b.calls);
    const t = String(b.task);
    return {
      task: t,
      calls,
      okPct: calls ? Math.round((100 * Number(b.ok)) / calls) : 0,
      fallbackByReason: Object.fromEntries(reasons.filter((r) => r.task === t).map((r) => [String(r.reason), Number(r.n)])),
      reservePct: Number(b.ok) ? Math.round((100 * Number(b.reserve)) / Number(b.ok)) : 0,
      costUsd: Number(b.cost),
      avgCostUsd: calls ? Number(b.cost) / calls : 0,
      p50Ms: b.p50 == null ? null : Math.round(Number(b.p50)),
      topBlocks: blocks.filter((x) => x.task === t).slice(0, 3).map((x) => ({ reason: String(x.reason), n: Number(x.n) })),
    };
  });
  // Cada ativação (pacote) ou aprovação (plano) grava as edições no mesmo instante: 1 decisão = (restaurante, instante).
  const edits = await q(
    ex,
    sql`select split_part(e.kind, ':', 1) what,
          count(distinct (e.restaurant_id, e.at)) filter (where e.kind like '%:sem_edicao')::int accepted,
          count(distinct (e.restaurant_id, e.at))::int total
        from owner_edits e
        where (e.kind like 'pacote:%' or e.kind like 'plano:%') and e.kind <> 'plano:descartado'
          and e.restaurant_id not in ${E2E_RESTAURANTS}
          -- Pacote e plano: só o escrito pela IA (o "Exemplo pronto" e o modo sem IA não contam como acerto da IA —
          -- revisão S3; o pacote também, desde a S9, M10). A ativação grava o pacote aprovado no mesmo instante.
          and exists (select 1 from weekly_plans wp where wp.restaurant_id = e.restaurant_id and wp.approved_at = e.at and wp.texts->>'generatedBy' = 'ia')
        group by 1`,
  );
  // "IA ≠ maior nota" (revisão da S2 #29): escolhas originais da IA × candidata de maior nota, por faixa.
  const plans = await q(ex, sql`select decision from weekly_plans where decision ? 'aiChoices' and decision->'aiChoices' <> 'null'::jsonb and restaurant_id not in ${E2E_RESTAURANTS}`);
  let compared = 0;
  let differs = 0;
  for (const p of plans) {
    const d = p.decision as { aiChoices: Array<{ slotId: string; candidateId: string }> | null; topScore?: Record<string, string | null> };
    for (const c of d.aiChoices ?? []) {
      const top = d.topScore?.[c.slotId];
      if (!top) continue;
      compared++;
      if (top !== c.candidateId) differs++;
    }
  }
  return {
    tasks,
    acceptedNoEdit: edits.map((e) => ({ what: String(e.what), accepted: Number(e.accepted), total: Number(e.total) })),
    aiVsTop: { compared, differs },
    totalCostUsd: tasks.reduce((s, t) => s + t.costUsd, 0),
  };
}

/** Página pública: memo de 60 s por processo (revisão de segurança S3). */
let memo: { at: number; v: QualityView } | null = null;
export async function getQualityViewCached(ex: Executor, now: Date = new Date()): Promise<QualityView> {
  if (memo && now.getTime() - memo.at < 60_000) return memo.v;
  const v = await getQualityView(ex);
  memo = { at: now.getTime(), v };
  return v;
}
