/**
 * Métricas do copiloto (S8 §3; revisão de aderência 3 e produto 3): só agregados, fora as contas de E2E.
 * Hipótese [H] (D231): o dono não ajusta porque Configurações é difícil — o copiloto deve aumentar as mudanças feitas.
 */
import { sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";

export type CopilotMetrics = {
  turns: number;
  turnsNoAiPct: number | null;
  /** S9 (item 17): turnos recusados por estarem fora do escopo; `byGate` = a IA disse "salão", o portão do código barrou. */
  outOfScope: { total: number; byGate: number };
  shown: number;
  applied: number;
  discarded: number;
  expired: number;
  failed: number;
  refusedByCode: number | null;
  appliedPct: number | null;
  p50SecToApply: number | null;
  byAction: Array<{ action: string; shown: number; applied: number }>;
  byOrigin: Array<{ origin: string; applied: number }>;
  editsLast7: { copilot: number; total: number };
};

type Row = Record<string, unknown>;
const q = async (ex: Executor, s: ReturnType<typeof sql>): Promise<Row[]> => ((await ex.execute(s)) as unknown as { rows: Row[] }).rows;
const E2E_RESTAURANTS = sql`(select r.id from restaurants r join owners o on o.id = r.owner_id where o.via = 'e2e' or (r.protected and r.kind = 'teste'))`;

export async function getCopilotMetrics(ex: Executor): Promise<CopilotMetrics> {
  const [p] = await q(
    ex,
    sql`select count(*)::int shown,
          count(*) filter (where status = 'aplicada')::int applied,
          count(*) filter (where status = 'descartada')::int discarded,
          count(*) filter (where status = 'expirada')::int expired,
          count(*) filter (where status = 'falhou')::int failed,
          percentile_cont(0.5) within group (order by extract(epoch from decided_at - created_at)) filter (where status = 'aplicada') p50
        from agent_proposals where restaurant_id not in ${E2E_RESTAURANTS}`,
  );
  const [t] = await q(
    ex,
    sql`select count(*)::int turns, count(*) filter (where status <> 'ok')::int noai,
          count(*) filter (where attempts @> '[{"notes":["fora_do_escopo"]}]'::jsonb)::int fora,
          count(*) filter (where attempts @> '[{"notes":["fora_do_escopo"]}]'::jsonb and not attempts @> '[{"notes":["escopo:classificacao"]}]'::jsonb)::int fora_portao
        from ai_calls where task = 'copiloto' and (restaurant_id is null or restaurant_id not in ${E2E_RESTAURANTS})`,
  );
  const byAction = await q(ex, sql`select action, count(*)::int shown, count(*) filter (where status = 'aplicada')::int applied from agent_proposals where restaurant_id not in ${E2E_RESTAURANTS} group by action order by shown desc`);
  const byOrigin = await q(ex, sql`select origin, count(*) filter (where status = 'aplicada')::int applied from agent_proposals where restaurant_id not in ${E2E_RESTAURANTS} group by origin order by origin`);
  // Mudanças nas Configurações nos últimos 7 dias (owner_edits) e quantas vieram do copiloto/MCP (propostas aplicadas).
  const [e] = await q(
    ex,
    sql`select (select count(*)::int from owner_edits where kind like 'config:%' and at > now() - interval '7 days' and restaurant_id not in ${E2E_RESTAURANTS}) total,
               (select count(*)::int from agent_proposals where status = 'aplicada' and decided_at > now() - interval '7 days' and restaurant_id not in ${E2E_RESTAURANTS}) copilot`,
  );
  const shown = Number(p?.shown ?? 0);
  const applied = Number(p?.applied ?? 0);
  const turns = Number(t?.turns ?? 0);
  return {
    turns,
    turnsNoAiPct: turns ? Math.round((100 * Number(t?.noai ?? 0)) / turns) : null,
    outOfScope: { total: Number(t?.fora ?? 0), byGate: Number(t?.fora_portao ?? 0) },
    shown,
    applied,
    discarded: Number(p?.discarded ?? 0),
    expired: Number(p?.expired ?? 0),
    failed: Number(p?.failed ?? 0),
    // Recusas do código não são gravadas (só aparecem no cartão); fica para o piloto.
    refusedByCode: null,
    appliedPct: shown ? Math.round((100 * applied) / shown) : null,
    p50SecToApply: p?.p50 === null || p?.p50 === undefined ? null : Math.round(Number(p.p50)),
    byAction: byAction.map((r) => ({ action: String(r.action), shown: Number(r.shown), applied: Number(r.applied) })),
    byOrigin: byOrigin.map((r) => ({ origin: String(r.origin), applied: Number(r.applied) })),
    editsLast7: { copilot: Number(e?.copilot ?? 0), total: Number(e?.total ?? 0) },
  };
}

/** Título da proposta aplicada (faixa "Atualizado pelo assistente" em Configurações). Prefixo de 8 caracteres do id. */
export async function appliedProposalTitle(ex: Executor, restaurantId: string, prefix: string): Promise<string | null> {
  if (!/^[0-9a-f]{8}$/.test(prefix)) return null;
  const [r] = await q(ex, sql`select preview->>'titulo' t from agent_proposals where restaurant_id = ${restaurantId} and status = 'aplicada' and id::text like ${prefix + "%"} order by decided_at desc limit 1`);
  return r?.t ? String(r.t) : null;
}
