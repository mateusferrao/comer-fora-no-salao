/**
 * Vista do plano da semana para a tela (planejamento S3 §4.3): insights do código, "o que aprendemos" renderizado,
 * proposta por faixa, prévia da reativação (cota de 50% — D142) e histórico. Textos com referências → renderizados.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { weeklyPlans } from "@/src/db/schema";
import { describeOffer, type Offer, type OfferKind } from "@/src/modules/beneficios/domain/offers";
import { slotLabel, slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import { renderReferences } from "@/src/modules/textos/domain/references";
import { toReactivationCustomers } from "@/src/modules/analytics/application/customers";
import { inviteSlots, remainingBySlot, toVersionedOffer } from "@/src/modules/salao/application/context";
import { weekKeySP } from "@/src/shared/week";
import { reactivationAudience, reactivationPlan, reactivationQuota, REACTIVATION_SHARE_PCT } from "../domain/reactivation";
import { getPlanInsights, versionForKey, type PlanInsights } from "./insights";
import { GENERATING_STALE_MS } from "./generating";
import { effectiveReview, type StoredReview } from "@/src/modules/ia/tasks/reviewer";

export type PlanOptionView = { id: string; offer: { kind: OfferKind; itemId: string; pct?: number }; title: string; gain: string; unitCostCents: number; score: number; isTop: boolean };
export type PlanSlotView = { slotId: string; label: string; phrase: string; extraTables: number; options: PlanOptionView[]; chosenId: string | null; inviteText: string; inviteRendered: string; justificativa: string; weeklyCap: number };
export type PlanView = {
  plan: { id: string; status: string; weekKey: string; generatedBy: "ia" | "sem_ia" | "fixo"; semIa?: string; approvedVia: string | null; stale: boolean; currentWeek: boolean; review: StoredReview | null; agentSteps: Array<{ label: string; ms: number }> } | null;
  generating: boolean;
  insights: Pick<PlanInsights, "heatmap" | "segments" | "today"> & { offers: Array<PlanInsights["offers"][number] & { slotLabel: string }>; lowTurns: string[] };
  learned: Array<{ ofertaKey: string; verdict: string; texto: string; title: string }>;
  slots: PlanSlotView[];
  reactivation: { audience: number; bySegment: { sumiu: number; perto: number }; real: number; fantasma: number; quota: Array<{ slotLabel: string; use: number; free: number; left: number }> };
  menu: Array<{ id: string; name: string; category: string }>;
  history: Array<{ id: string; weekKey: string; status: string; via: string | null; approvedAt: string | null; sent: number }>;
};

/** `planId`: um plano específico (o revisor revisa exatamente o que foi gerado); sem ele, o mais recente. */
export async function getPlanView(db: Db, restaurantId: string, now: Date, planId?: string): Promise<PlanView | null> {
  const ins = await getPlanInsights(db, restaurantId, now);
  if (!ins) return null;
  const { ctx } = ins;
  const [plan] = await db
    .select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.restaurantId, restaurantId), planId ? eq(weeklyPlans.id, planId) : sql`${weeklyPlans.status} <> 'descartado'`))
    .orderBy(desc(weeklyPlans.createdAt))
    .limit(1);
  const generating = !!plan && plan.status === "gerando" && now.getTime() - plan.createdAt.getTime() < GENERATING_STALE_MS;
  const items = Object.fromEntries(ctx.menu.map((m) => [m.id, m.name]));
  const slotsCtx = Object.fromEntries(ctx.slots.map((s) => [s.id, slotPhrase(s)]));
  const facts = (plan?.facts ?? ins.facts) as Record<string, number | string>;

  const shown = plan && plan.status !== "gerando" ? plan : null;
  const cands = (shown?.candidates ?? []) as Array<{ slotId: string; options: Array<{ id: string; offer: { kind: OfferKind; itemId: string; pct?: number }; score: number; unitCostCents: number; weeklyCap: number }> }>;
  const choices = (shown?.choices ?? []) as Array<{ slotId: string; candidateId: string; textoConvite: string; justificativa: string }>;
  const order = ((shown?.texts as { order?: string[] } | undefined)?.order ?? ctx.slots.map((s) => s.id)).filter((id) => ctx.slots.some((s) => s.id === id));
  const caps = (shown?.decision as { caps?: Record<string, number> } | null)?.caps ?? {};
  const toOffer = (o: { kind: OfferKind; itemId: string; pct?: number }): Offer => ({ kind: o.kind, params: { itemId: o.itemId, ...(o.pct !== undefined ? { pct: o.pct } : {}) } });

  const slots: PlanSlotView[] = order.map((sid) => {
    const s = ctx.slots.find((x) => x.id === sid)!;
    const opts = (cands.find((c) => c.slotId === sid)?.options ?? []).map((o, i) => {
      const d = describeOffer(toOffer(o.offer), ctx.menu, "convite");
      return { id: o.id, offer: o.offer, title: d.title, gain: d.gain, unitCostCents: o.unitCostCents, score: o.score, isTop: i === 0 };
    });
    const ch = choices.find((c) => c.slotId === sid);
    let chosen = opts.find((o) => o.id === ch?.candidateId) ?? null;
    // Plano aprovado com escolha manual (fora das candidatas): mostra a regra vigente.
    if (!chosen && ch?.candidateId?.startsWith("manual:") && ctx.convites[sid]) {
      const v = ctx.convites[sid]!;
      const d = describeOffer(v.offer, ctx.menu, "convite");
      chosen = { id: ch.candidateId, offer: { kind: v.offer.kind, itemId: v.offer.params.itemId, ...(v.offer.params.pct !== undefined ? { pct: v.offer.params.pct } : {}) }, title: d.title, gain: d.gain, unitCostCents: 0, score: 0, isTop: false };
      opts.push(chosen);
    }
    const rctx = { facts, items, slots: slotsCtx, oferta: chosen?.gain };
    return {
      slotId: sid,
      label: slotLabel(s),
      phrase: slotPhrase(s),
      extraTables: s.extraTables,
      options: opts,
      chosenId: chosen?.id ?? null,
      inviteText: ch?.textoConvite ?? "",
      inviteRendered: renderReferences(ch?.textoConvite ?? "", rctx),
      justificativa: renderReferences(ch?.justificativa ?? "", rctx),
      weeklyCap: caps[sid] ?? cands.find((c) => c.slotId === sid)?.options.find((o) => o.id === chosen?.id)?.weeklyCap ?? ctx.convites[sid]?.weeklyCap ?? 1,
    };
  });

  const learned: PlanView["learned"] = [];
  for (const l of (shown?.learned ?? []) as Array<{ ofertaKey: string; verdict: string; texto: string }>) {
    const row = await versionForKey(db, restaurantId, l.ofertaKey);
    const v = row ? toVersionedOffer(row) : null;
    const d = v ? describeOffer(v.offer, ctx.menu, "convite") : null;
    learned.push({ ofertaKey: l.ofertaKey, verdict: l.verdict, texto: renderReferences(l.texto, { facts, items, slots: slotsCtx, oferta: d?.gain }), title: d ? `${d.title}` : "Oferta anterior" });
  }

  // Prévia da reativação com a regra vigente (a aprovação recalcula com a regra nova).
  const rows = ins.customers;
  const rc = toReactivationCustomers(rows);
  const audience = reactivationAudience(rc);
  const remaining = await remainingBySlot(db, ctx, weekKeySP(now));
  const plan2 = reactivationPlan(rc, inviteSlots(ctx), remaining, { sharePct: REACTIVATION_SHARE_PCT, restaurantId }, now);
  const quota = reactivationQuota(remaining, REACTIVATION_SHARE_PCT);
  const usedBy: Record<string, number> = {};
  for (const x of plan2) if (x.decision.kind === "real") usedBy[x.decision.slotId] = (usedBy[x.decision.slotId] ?? 0) + 1;

  const history = (await db.execute(sql`
    select wp.id, wp.week_key, wp.status, wp.approved_via, wp.approved_at, coalesce(ps.recipients, 0) sent
    from weekly_plans wp left join plan_sends ps on ps.plan_id = wp.id
    where wp.restaurant_id = ${restaurantId} and wp.status in ('aprovado', 'descartado') order by wp.created_at desc limit 12`)) as unknown as { rows: Array<Record<string, unknown>> };

  return {
    plan: shown
      ? {
          id: shown.id,
          status: shown.status,
          weekKey: shown.weekKey,
          generatedBy: ((shown.texts as { generatedBy?: "ia" | "sem_ia" | "fixo" }).generatedBy ?? "sem_ia"),
          semIa: (shown.decision as { semIa?: string } | null)?.semIa,
          approvedVia: shown.approvedVia,
          // S6.3b (D194): passos do agente, quando o plano saiu dele.
          agentSteps: ((shown.agentSteps ?? []) as Array<{ label: string; ms: number }>).map((x) => ({ label: x.label, ms: x.ms })),
          stale: shown.weekKey < weekKeySP(now),
          currentWeek: shown.weekKey === weekKeySP(now),
          review: effectiveReview((shown.decision as { reviewer?: StoredReview } | null)?.reviewer, now),
        }
      : null,
    generating,
    insights: {
      today: ins.today,
      heatmap: ins.heatmap,
      segments: ins.segments,
      offers: ins.offers.map((o) => ({ ...o, slotLabel: slotLabel(ctx.slots.find((s) => s.id === o.slotId)!) })),
      lowTurns: ins.heatmap.lowUndeclared.map((_c, i) => String(ins.facts[`turno_pouco_${i + 1}`] ?? "")),
    },
    learned,
    slots,
    reactivation: {
      audience: audience.length,
      bySegment: { sumiu: audience.filter((c) => c.segments.includes("sumiu")).length, perto: audience.filter((c) => c.segments.includes("perto")).length },
      real: plan2.filter((x) => x.decision.kind === "real").length,
      fantasma: plan2.filter((x) => x.decision.kind === "fantasma").length,
      quota: inviteSlots(ctx).map((s) => ({ slotLabel: slotLabel(s), use: Math.min(usedBy[s.id] ?? 0, quota[s.id] ?? 0), free: remaining[s.id] ?? 0, left: (remaining[s.id] ?? 0) - (usedBy[s.id] ?? 0) })),
    },
    menu: ctx.menu.filter((m) => !ctx.inactiveItemIds.includes(m.id) && !ctx.noOfferItemIds.includes(m.id)).map((m) => ({ id: m.id, name: m.name, category: m.category })),
    history: history.rows.map((h) => ({ id: String(h.id), weekKey: String(h.week_key), status: String(h.status), via: (h.approved_via as string | null) ?? null, approvedAt: h.approved_at ? new Date(String(h.approved_at)).toISOString() : null, sent: Number(h.sent ?? 0) })),
  };
}

