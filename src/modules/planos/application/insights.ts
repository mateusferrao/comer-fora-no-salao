/**
 * Insights do plano da semana (espec. 3.7.1; planejamento S3 §4.3–4.4): o código calcula os fatos (chaves
 * estáveis), o mapa dia × turno, o veredito por oferta e o teto recalibrado. Nada de PII: só agregados.
 */
import { hasOptIn } from "@/src/modules/analytics/application/customers";
import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { benefits, benefitVersions, invites } from "@/src/db/schema";
import { describeOffer } from "@/src/modules/beneficios/domain/offers";
import { loadContext, type RestaurantContext } from "@/src/modules/salao/application/context";
import { slotAliases } from "@/src/modules/beneficios/domain/slot-text";
import { declaredFacts } from "@/src/modules/onboarding/domain/facts";
import { recalibratedCap } from "@/src/modules/onboarding/domain/candidates";
import { turnHeatmap, type HeatCell } from "@/src/modules/analytics/domain/insights";
import { verdict, verdictInputs, VERDICT_MIN_ISSUED, type Verdict } from "@/src/modules/analytics/domain/verdict";
import { loadCustomerRows } from "@/src/modules/analytics/application/customers";
import { SEGMENTS, type Segment } from "@/src/modules/analytics/domain/segments";
import type { LearnedInput } from "@/src/modules/ia/tasks/package";
import type { Turn } from "@/src/modules/beneficios/domain/slots";
import { daySP } from "@/src/shared/tz";
import { addDaysSP, weekdayOfDay } from "@/src/shared/week";
import { issuedFactKey, usageFactKey } from "../domain/plan-facts";

export type OfferInsight = {
  slotId: string;
  alias: string;
  key: string;
  title: string;
  gain: string;
  verdict: Verdict;
  issued7d: number;
  used7d: number;
  issued30d: number;
  usage: number | null;
  recalibratedCap: number;
};

export type PlanInsights = {
  today: string;
  facts: Record<string, number | string>;
  heatmap: { cells: HeatCell[]; lowUndeclared: HeatCell[] };
  offers: OfferInsight[];
  segments: Record<Segment, { count: number; optIn: number }>;
  learned: LearnedInput[];
  ctx: RestaurantContext;
  /** Linhas de clientes já carregadas (a prévia da reativação reaproveita — revisão S3 #36). */
  customers: Awaited<ReturnType<typeof loadCustomerRows>>;
};

const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const TURN: Record<string, string> = { almoco: "almoço", tarde: "tarde", noite: "noite" };

export async function getPlanInsights(ex: Executor, restaurantId: string, now: Date): Promise<PlanInsights | null> {
  const ctx = await loadContext(ex, restaurantId);
  if (!ctx) return null;
  const today = daySP(now);
  const from30 = addDaysSP(today, -29);
  const ck = ((await ex.execute(sql`select day_sp, turn from checkins where restaurant_id = ${restaurantId} and day_sp >= ${from30}`)) as unknown as { rows: Array<{ day_sp: string; turn: Turn }> }).rows;
  const heatmap = turnHeatmap(ck.map((c) => ({ day: c.day_sp, turn: c.turn })), ctx.slots, ctx.opening);

  // Veredito sobre a oferta vigente na semana ANTERIOR (D220; revisão técnica S3): a versão que valia no início
  // desta semana (segunda 0h em SP). Sem versão anterior (faixa nova nesta semana), vale a atual.
  const monday = addDaysSP(today, -((weekdayOfDay(today) + 6) % 7));
  const weekStart = new Date(`${monday}T03:00:00Z`);
  const prevRows = ctx.slots.length
    ? await ex
        .select({ id: benefitVersions.id, version: benefitVersions.version, slotId: benefits.slotId, kind: benefitVersions.kind, params: benefitVersions.params })
        .from(benefitVersions)
        .innerJoin(benefits, eq(benefits.id, benefitVersions.benefitId))
        .where(and(eq(benefitVersions.restaurantId, restaurantId), eq(benefits.role, "convite"), lte(benefitVersions.validFrom, weekStart), or(isNull(benefitVersions.supersededAt), gt(benefitVersions.supersededAt, weekStart))))
    : [];
  const prevBySlot = new Map(prevRows.map((r) => [r.slotId!, r]));
  const versionOf = (slotId: string) => prevBySlot.get(slotId)?.id ?? ctx.convites[slotId]?.versionId;
  const versionIds = ctx.slots.map((s) => versionOf(s.id)).filter((x): x is string => !!x);
  const versions = versionIds.length ? await ex.select({ id: benefitVersions.id, version: benefitVersions.version }).from(benefitVersions).where(inArray(benefitVersions.id, versionIds)) : [];
  const vnum = new Map(versions.map((v) => [v.id, v.version]));
  const invRows = versionIds.length
    ? await ex
        .select({ benefit_version_id: invites.benefitVersionId, issued_day: invites.issuedDay, used_at: invites.usedAt })
        .from(invites)
        .where(and(eq(invites.restaurantId, restaurantId), eq(invites.arm, "convidavel"), inArray(invites.benefitVersionId, versionIds)))
    : [];

  const facts: Record<string, number | string> = { ...declaredFacts(ctx.restaurant, ctx.slots, ctx.menu.filter((m) => !ctx.inactiveItemIds.includes(m.id))) };
  facts.checkins_30d = ck.length;
  const offers: OfferInsight[] = [];
  for (const { alias, slot } of slotAliases(ctx.slots)) {
    const cur = ctx.convites[slot.id];
    const prev = prevBySlot.get(slot.id);
    const v = prev ? { versionId: prev.id, offer: { kind: prev.kind, params: prev.params } as NonNullable<typeof cur>["offer"] } : cur;
    if (!v) continue;
    const inv = invRows.filter((r) => r.benefit_version_id === v.versionId).map((r) => ({ issuedDay: r.issued_day, usedDay: r.used_at ? daySP(r.used_at) : null }));
    const x = verdictInputs(inv, today, addDaysSP);
    const usage = x.issued7d >= VERDICT_MIN_ISSUED ? x.used7d / x.issued7d : null;
    const d = describeOffer(v.offer, ctx.menu, "convite");
    const issued30d = inv.filter((i) => i.issuedDay >= from30).length;
    offers.push({ slotId: slot.id, alias, key: `${slot.id}:v${vnum.get(v.versionId) ?? 1}`, title: d.title, gain: d.gain, verdict: verdict(x), issued7d: x.issued7d, used7d: x.used7d, issued30d, usage, recalibratedCap: recalibratedCap(slot.extraTables, usage) });
    facts[usageFactKey(alias)] = x.issued7d ? Math.round((100 * x.used7d) / x.issued7d) : 0;
    facts[issuedFactKey(alias)] = x.issued7d;
    facts[`convites_${alias}_emitidos`] = issued30d;
  }

  const rows = await loadCustomerRows(ex, restaurantId, now);
  facts.clientes_30d = rows.filter((r) => (r.lastDay ?? "") >= from30).length;
  const segments = Object.fromEntries(SEGMENTS.map((s) => [s, { count: 0, optIn: 0 }])) as PlanInsights["segments"];
  for (const c of rows) for (const s of c.segments) {
    segments[s].count++;
    if (hasOptIn(c)) segments[s].optIn++;
  }
  facts.segmento_sumiu = segments.sumiu.count;
  facts.segmento_perto = segments.perto.count;
  facts.segmento_frequente = segments.frequente.count;
  heatmap.lowUndeclared.forEach((c, i) => (facts[`turno_pouco_${i + 1}`] = `${WD[c.weekday]} no ${TURN[c.turn]}`.replace("no tarde", "à tarde").replace("no noite", "à noite")));

  const learned: LearnedInput[] = offers.map((o) => ({ key: o.key, slotId: o.slotId, verdict: o.verdict, gain: o.gain, title: o.title }));
  return { today, facts, heatmap, offers, segments, learned, ctx, customers: rows };
}

/** Versão da oferta de uma chave `<slotId>:v<n>` (para descrever o "o que aprendemos"). */
export async function versionForKey(ex: Executor, restaurantId: string, key: string) {
  const [slotId, v] = key.split(":") as [string, string | undefined];
  const n = Number(v?.slice(1));
  if (!slotId || !Number.isFinite(n)) return null;
  const [row] = await ex
    .select({ v: benefitVersions })
    .from(benefitVersions)
    .innerJoin(benefits, eq(benefits.id, benefitVersions.benefitId))
    .where(and(eq(benefits.restaurantId, restaurantId), eq(benefits.slotId, slotId), eq(benefitVersions.version, n)))
    .limit(1);
  return row?.v ?? null;
}
