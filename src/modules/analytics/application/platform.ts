/**
 * Visão da plataforma (D144; espec. 2 — métricas do iFood): agregada sobre os restaurantes de teste criados por
 * visitantes do protótipo (fora: vitrine, cópias de demonstração, restaurante e contas do E2E e dados simulados).
 */
import { sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { daySP } from "@/src/shared/tz";
import { addDaysSP } from "@/src/shared/week";

export type PlatformView = {
  created: number;
  activated: number;
  divulgandoPct: number | null;
  /** % dos restaurantes criados (não só ativados) com leitura real em 7 dias. */
  divulgandoCriadosPct: number | null;
  newUsers30d: number;
  medianActivationMin: number | null;
  funnel: Array<{ step: number; entered: number; completed: number }>;
  /** S9 (IA M9): só a ativação (cardápio, pacote, kit e a revisão do kit) ÷ restaurantes ativados. */
  aiCostPerActivatedUsd: number | null;
  /** Plano da semana (chamada única ou agente + revisor do plano) ÷ planos com chamada de IA. */
  aiCostPerPlanUsd: number | null;
  plans: number;
  /** Assistente do salão (conversa e a frase do "Seu salão"), total. */
  aiCostAssistantUsd: number;
  aiCostTotalUsd: number;
};

type Row = Record<string, unknown>;
const q = async (ex: Executor, s: ReturnType<typeof sql>): Promise<Row[]> => ((await ex.execute(s)) as unknown as { rows: Row[] }).rows;

// Restaurantes de teste "de verdade" (criados por pessoas no protótipo).
const BASE = sql`select r.id, r.created_at, r.activated_at, r.status from restaurants r join owners o on o.id = r.owner_id
  where r.kind = 'teste' and not r.protected and r.copied_from is null and coalesce(o.via, '') <> 'e2e'`;

export async function getPlatformView(ex: Executor, now: Date): Promise<PlatformView> {
  const today = daySP(now);
  const [c] = await q(
    ex,
    sql`with b as (${BASE}) select count(*)::int created, count(*) filter (where status = 'ativo')::int activated,
        percentile_cont(0.5) within group (order by extract(epoch from (activated_at - created_at)) / 60) filter (where activated_at is not null and activated_at >= created_at) med
        from b`,
  );
  const [d] = await q(
    ex,
    sql`with b as (${BASE}) select count(distinct s.restaurant_id)::int n from scans s join b on b.id = s.restaurant_id
        where b.status = 'ativo' and s.simulation_run_id is null and s.day_sp >= ${addDaysSP(today, -6)}`,
  );
  const [u] = await q(
    ex,
    sql`with b as (${BASE}) select count(*)::int n from restaurant_customers rc join b on b.id = rc.restaurant_id
        join customers cu on cu.id = rc.customer_id
        where rc.origin_variant_id is not null and cu.simulation_run_id is null
          and (select min(c.at) from checkins c where c.customer_id = rc.customer_id) = (select min(c2.at) from checkins c2 where c2.customer_id = rc.customer_id and c2.restaurant_id = rc.restaurant_id)
          and (select min(c3.day_sp) from checkins c3 where c3.customer_id = rc.customer_id) >= ${addDaysSP(today, -29)}`,
  );
  const steps = await q(
    ex,
    sql`with b as (${BASE}) select e.step, count(distinct e.restaurant_id) filter (where e.event = 'entrou')::int entered,
        count(distinct e.restaurant_id) filter (where e.event = 'concluiu')::int completed
        from onboarding_events e join b on b.id = e.restaurant_id group by e.step order by e.step`,
  );
  const [ai] = await q(
    ex,
    sql`with b as (${BASE}), a as (select a.* from ai_calls a join b on b.id = a.restaurant_id)
        select coalesce(sum(cost_usd), 0)::float total,
          coalesce(sum(cost_usd) filter (where task in ('cardapio', 'pacote', 'kit') or (task = 'revisor' and plan_id is null)), 0)::float ativacao,
          coalesce(sum(cost_usd) filter (where task in ('plano', 'plano_agente') or (task = 'revisor' and plan_id is not null)), 0)::float plano,
          count(distinct plan_id) filter (where task in ('plano', 'plano_agente'))::int planos,
          coalesce(sum(cost_usd) filter (where task in ('copiloto', 'salao_frase')), 0)::float assistente
        from a`,
  );
  const activated = Number(c?.activated ?? 0);
  const plans = Number(ai?.planos ?? 0);
  return {
    created: Number(c?.created ?? 0),
    activated,
    divulgandoPct: activated ? Math.round((100 * Number(d?.n ?? 0)) / activated) : null,
    divulgandoCriadosPct: Number(c?.created ?? 0) ? Math.round((100 * Number(d?.n ?? 0)) / Number(c!.created)) : null,
    newUsers30d: Number(u?.n ?? 0),
    medianActivationMin: c?.med == null ? null : Math.round(Number(c.med)),
    funnel: steps.map((s) => ({ step: Number(s.step), entered: Number(s.entered), completed: Number(s.completed) })),
    aiCostPerActivatedUsd: activated ? Number(ai?.ativacao ?? 0) / activated : null,
    aiCostPerPlanUsd: plans ? Number(ai?.plano ?? 0) / plans : null,
    plans,
    aiCostAssistantUsd: Number(ai?.assistente ?? 0),
    aiCostTotalUsd: Number(ai?.total ?? 0),
  };
}

/** Página pública e anônima: memo de 60 s por processo (protege o Postgres compartilhado — revisão de segurança S3). */
let memo: { at: number; v: PlatformView } | null = null;
export async function getPlatformViewCached(ex: Executor, now: Date): Promise<PlatformView> {
  if (memo && now.getTime() - memo.at < 60_000) return memo.v;
  const v = await getPlatformView(ex, now);
  memo = { at: now.getTime(), v };
  return v;
}
