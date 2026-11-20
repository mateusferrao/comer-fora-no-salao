/**
 * Painel do dono (espec. 2, 3.6; planejamento S3 §4.2): métrica principal contra o holdout, funil, cartões e
 * estado do plano. Tudo por restaurante (o chamador garante que é o da sessão). Sem PII.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { simulationRuns, weeklyPlans } from "@/src/db/schema";
import { unitCost } from "@/src/modules/beneficios/domain/offers";
import { isInSlot } from "@/src/modules/beneficios/domain/slots";
import { loadContext, loadVersion, type RestaurantContext } from "@/src/modules/salao/application/context";
import { cohorts, marginIncrement, MIN_N, welch, type CohortRow, type Incremental } from "../domain/incremental";
import { buildSamples, WINDOW_DAYS } from "../domain/samples";
import { funnelSteps, periodRange, type FunnelCounts, type FunnelStep, type Period } from "../domain/funnel";
import { daySP } from "@/src/shared/tz";
import { addDaysSP, weekKeySP } from "@/src/shared/week";

export type MetricView = {
  inc: Incremental;
  /** Clientes do grupo de controle que ainda faltam (com 14 dias completos) para sair de "amostra insuficiente". */
  missingHoldout: number;
  /** Visitas a mais no total dos convidados (diff × nT), quando há resultado. */
  totalExtra: number | null;
  margin: { cents: number; lo: number; hi: number } | null;
  marginDeclared: boolean;
  idle: Incremental;
  migration: Incremental;
};

export type CardsView = {
  cohorts: CohortRow[];
  /** Custo dos convites usados ÷ convites reais emitidos (30 dias). */
  costPerInviteCents: number | null;
  /** Custo do "agora" validado ÷ clientes novos (30 dias). */
  costPerIdentifiedCents: number | null;
  /** Custo dos benefícios validados ÷ margem estimada das visitas registradas (30 dias), em %. */
  costOverMarginPct: number | null;
};

export type PlanBadge = { id: string; status: "gerando" | "proposto" | "aprovado" | "descartado" | "vencido"; weekKey: string; generatedBy: string | null } | null;

export type DashboardView = {
  today: string;
  restaurant: { id: string; kind: string; status: string; copy: boolean; simulated: boolean };
  metric: MetricView;
  newUsers30d: number;
  funnel: { period: Period; steps: FunnelStep[]; side: { invitesReactivation: number; firstVisitValidated: number }; variants: Array<{ id: string; label: string }> };
  cards: CardsView;
  plan: PlanBadge;
};

type Row = Record<string, unknown>;
const rows = async (ex: Executor, q: ReturnType<typeof sql>): Promise<Row[]> => ((await ex.execute(q)) as unknown as { rows: Row[] }).rows;
const num = (v: unknown) => Number(v ?? 0);

export async function getFunnel(ex: Executor, restaurantId: string, today: string, period: Period, variantId?: string): Promise<DashboardView["funnel"]> {
  const { from, to } = periodRange(period, today);
  const v = variantId ?? null;
  // Filtro por peça: leituras e check-ins pela própria versão; o resto pela peça de origem do cliente (D145).
  const byOrigin = (alias: string) => (v ? sql`and exists (select 1 from restaurant_customers rc where rc.restaurant_id = ${restaurantId} and rc.customer_id = ${sql.raw(alias)}.customer_id and rc.origin_variant_id = ${v})` : sql``);
  const [r] = await rows(
    ex,
    sql`select
      (select count(*) from scans s where s.restaurant_id = ${restaurantId} and s.day_sp between ${from} and ${to} ${v ? sql`and s.variant_id = ${v}` : sql``}) as scans,
      (select count(*) from checkins c where c.restaurant_id = ${restaurantId} and c.day_sp between ${from} and ${to} ${v ? sql`and c.variant_id = ${v}` : sql``}) as checkins,
      (select count(*) from (select c.customer_id, min(c.day_sp) d from checkins c where c.restaurant_id = ${restaurantId} group by c.customer_id) f where f.d between ${from} and ${to} ${byOrigin("f")}) as new_contacts,
      (select count(*) from invites i where i.restaurant_id = ${restaurantId} and i.arm = 'convidavel' and i.origin = 'mesa' and i.issued_day between ${from} and ${to} ${byOrigin("i")}) as inv_table,
      (select count(*) from invites i where i.restaurant_id = ${restaurantId} and i.arm = 'convidavel' and i.origin = 'reativacao' and i.issued_day between ${from} and ${to} ${byOrigin("i")}) as inv_react,
      (select count(*) from codes k where k.restaurant_id = ${restaurantId} and k.type = 'convite' and k.valid_day between ${from} and ${to} ${byOrigin("k")}) as returns,
      (select count(*) from codes k where k.restaurant_id = ${restaurantId} and k.type = 'convite' and k.status = 'validado' and k.valid_day between ${from} and ${to} ${byOrigin("k")}) as inv_valid,
      (select count(*) from codes k where k.restaurant_id = ${restaurantId} and k.type = 'primeira_visita' and k.status = 'validado' and k.valid_day between ${from} and ${to} ${byOrigin("k")}) as first_valid`,
  );
  const c: FunnelCounts = {
    scans: num(r?.scans),
    checkins: num(r?.checkins),
    newContacts: num(r?.new_contacts),
    invitesTable: num(r?.inv_table),
    invitesReactivation: num(r?.inv_react),
    returnsWithInvite: num(r?.returns),
    inviteCodesValidated: num(r?.inv_valid),
    firstVisitValidated: num(r?.first_valid),
  };
  const variants = await rows(
    ex,
    sql`select pv.id, kp.kind, pv.label, pv.retired_at from piece_variants pv join kit_pieces kp on kp.id = pv.piece_id where pv.restaurant_id = ${restaurantId} and kp.kind <> 'garcom' order by kp.kind, pv.label, pv.created_at`,
  );
  const PIECE: Record<string, string> = { display: "Display de mesa", cartaz: "Cartaz" };
  return { period, ...funnelSteps(c), variants: variants.map((x) => ({ id: String(x.id), label: `${PIECE[String(x.kind)] ?? String(x.kind)} ${String(x.label)}${x.retired_at ? " (versão anterior)" : ""}` })) };
}

async function metricOf(ex: Executor, ctx: RestaurantContext, today: string): Promise<MetricView & { cards: CardsView }> {
  const rid = ctx.restaurant.id;
  const margin = ctx.restaurant.marginPct ?? undefined;
  // Sorteio = 1º convite (real ou fantasma) de cada cliente (D216).
  const drawRows = await rows(
    ex,
    sql`select distinct on (customer_id) customer_id, arm, issued_day from invites where restaurant_id = ${rid} order by customer_id, issued_at`,
  );
  const draws = drawRows.map((d) => ({ customerId: String(d.customer_id), arm: d.arm as "convidavel" | "holdout", drawDay: String(d.issued_day) }));
  const ckRows = await rows(ex, sql`select customer_id, day_sp, at from checkins where restaurant_id = ${rid} and day_sp >= ${addDaysSP(today, -120)}`);
  const visits = ckRows.map((c) => ({ customerId: String(c.customer_id), day: String(c.day_sp), idle: ctx.slots.some((s) => isInSlot(s, new Date(String(c.at)))) }));

  // Custo dos convites usados (valor da versão da emissão), por cliente e dia.
  const costRows = await rows(
    ex,
    sql`select k.customer_id, k.valid_day, k.type, k.benefit_version_id from codes k where k.restaurant_id = ${rid} and k.status = 'validado' and k.valid_day >= ${addDaysSP(today, -120)}`,
  );
  const versionCost = new Map<string, number>();
  const costOf = async (versionId: string | null) => {
    if (!versionId) return 0;
    if (!versionCost.has(versionId)) {
      const v = await loadVersion(ex, versionId);
      versionCost.set(versionId, v ? unitCost(v.offer, ctx.menu, margin).cents : 0);
    }
    return versionCost.get(versionId)!;
  };
  const inviteCosts: Array<{ customerId: string; day: string; cents: number }> = [];
  let firstVisitCost30 = 0;
  let benefitCost30 = 0;
  const since30 = addDaysSP(today, -29);
  for (const k of costRows) {
    const cents = await costOf(k.benefit_version_id ? String(k.benefit_version_id) : null);
    const day = String(k.valid_day);
    if (k.type === "convite") inviteCosts.push({ customerId: String(k.customer_id), day, cents });
    if (day >= since30) {
      benefitCost30 += cents;
      if (k.type === "primeira_visita") firstVisitCost30 += cents;
    }
  }

  const s = buildSamples({ draws, visits, costs: inviteCosts, today });
  const inc = welch(s.t, s.h);
  const declared = ctx.restaurant.ticketCents != null && ctx.restaurant.marginPct != null;
  const m =
    declared && (inc.state === "positivo" || inc.state === "negativo")
      ? marginIncrement({ inc, ticketCents: ctx.restaurant.ticketCents!, marginPct: ctx.restaurant.marginPct!, costConvCents: s.costConvCents, costHoldCents: s.costHoldCents })
      : null;

  // Cartões antecipados (30 dias, não causal).
  const invRows = await rows(ex, sql`select issued_day, used_at, benefit_version_id from invites where restaurant_id = ${rid} and arm = 'convidavel'`);
  const cohortRows = cohorts(
    invRows.map((i) => ({ issuedDay: String(i.issued_day), usedDay: i.used_at ? daySP(new Date(String(i.used_at))) : null })),
    today,
    WINDOW_DAYS,
  ).slice(-6);
  const issued30 = invRows.filter((i) => String(i.issued_day) >= since30).length;
  const usedCost30 = inviteCosts.filter((c) => c.day >= since30).reduce((a, c) => a + c.cents, 0);
  const [nc] = await rows(ex, sql`select count(*) n from (select customer_id, min(day_sp) d from checkins where restaurant_id = ${rid} group by customer_id) f where f.d >= ${since30}`);
  const newContacts30 = num(nc?.n);
  const ck30 = visits.filter((v) => v.day >= since30).length;
  const marginOfVisits = declared ? (ck30 * ctx.restaurant.ticketCents! * ctx.restaurant.marginPct!) / 100 : 0;

  return {
    inc,
    missingHoldout: inc.state === "amostra_insuficiente" ? Math.max(0, MIN_N - inc.nH) : 0,
    totalExtra: inc.state === "amostra_insuficiente" ? null : Math.round(inc.diff * inc.nT),
    margin: m,
    marginDeclared: declared,
    idle: welch(s.tIdle, s.hIdle),
    migration: welch(s.tPeak, s.hPeak),
    cards: {
      cohorts: cohortRows,
      costPerInviteCents: issued30 ? Math.round(usedCost30 / issued30) : null,
      costPerIdentifiedCents: newContacts30 ? Math.round(firstVisitCost30 / newContacts30) : null,
      costOverMarginPct: marginOfVisits > 0 ? Math.round((100 * benefitCost30) / marginOfVisits) : null,
    },
  };
}

export async function getPlanBadge(ex: Executor, restaurantId: string, now: Date): Promise<PlanBadge> {
  const [p] = await ex
    .select({ id: weeklyPlans.id, status: weeklyPlans.status, weekKey: weeklyPlans.weekKey, texts: weeklyPlans.texts })
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.restaurantId, restaurantId), sql`${weeklyPlans.status} <> 'descartado'`))
    .orderBy(desc(weeklyPlans.createdAt))
    .limit(1);
  if (!p) return null;
  const expired = p.status === "aprovado" && p.weekKey < weekKeySP(now);
  return { id: p.id, status: (expired ? "vencido" : p.status) as NonNullable<PlanBadge>["status"], weekKey: p.weekKey, generatedBy: (p.texts as { generatedBy?: string }).generatedBy ?? null };
}

export async function getNewUsers30d(ex: Executor, restaurantId: string, today: string): Promise<number> {
  // 1º check-in da vida (em qualquer restaurante) aqui, vindo de uma peça, nos últimos 30 dias.
  const [r] = await rows(
    ex,
    sql`select count(*) n from restaurant_customers rc
        where rc.restaurant_id = ${restaurantId} and rc.origin_variant_id is not null
          and (select min(c.day_sp) from checkins c where c.customer_id = rc.customer_id and c.restaurant_id = ${restaurantId}) >= ${addDaysSP(today, -29)}
          and not exists (select 1 from checkins o where o.customer_id = rc.customer_id and o.restaurant_id <> ${restaurantId}
                          and o.at < (select min(c2.at) from checkins c2 where c2.customer_id = rc.customer_id and c2.restaurant_id = ${restaurantId}))`,
  );
  return num(r?.n);
}

export async function getDashboard(ex: Executor, restaurantId: string, now: Date, opts: { period?: Period; variantId?: string } = {}): Promise<DashboardView | null> {
  const ctx = await loadContext(ex, restaurantId);
  if (!ctx) return null;
  const today = daySP(now);
  const metricCards = await metricOf(ex, ctx, today);
  const funnel = await getFunnel(ex, restaurantId, today, opts.period ?? "7d", opts.variantId);
  const newUsers = await getNewUsers30d(ex, restaurantId, today);
  const plan = await getPlanBadge(ex, restaurantId, now);
  const sim = await ex.select({ id: simulationRuns.id }).from(simulationRuns).where(eq(simulationRuns.restaurantId, restaurantId)).limit(1);
  const { cards, ...metric } = metricCards;
  return {
    today,
    restaurant: { id: restaurantId, kind: ctx.restaurant.kind, status: ctx.restaurant.status, copy: !!ctx.restaurant.copiedFrom, simulated: sim.length > 0 },
    metric,
    newUsers30d: newUsers,
    funnel,
    cards,
    plan,
  };
}

/** Eventos leves para o modo apresentação: último check-in depois de `since`. */
export async function getLatestCheckin(ex: Executor, restaurantId: string, since: Date): Promise<{ at: string; piece: string | null; holdout: boolean } | null> {
  const [r] = await rows(
    ex,
    sql`select c.at, kp.kind, pv.label, rc.arm from checkins c
        left join piece_variants pv on pv.id = c.variant_id left join kit_pieces kp on kp.id = pv.piece_id
        left join restaurant_customers rc on rc.restaurant_id = c.restaurant_id and rc.customer_id = c.customer_id
        where c.restaurant_id = ${restaurantId} and c.at > ${since.toISOString()} and c.simulation_run_id is null order by c.at desc limit 1`,
  );
  if (!r) return null;
  const PIECE: Record<string, string> = { display: "Display mesa", cartaz: "Cartaz" };
  return { at: new Date(String(r.at)).toISOString(), piece: r.kind ? `${PIECE[String(r.kind)] ?? String(r.kind)} ${String(r.label)}` : null, holdout: r.arm === "holdout" };
}

