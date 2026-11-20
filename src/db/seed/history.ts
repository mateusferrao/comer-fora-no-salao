/**
 * Histórico simulado da vitrine (60 dias — espec. 3.8, D104, D224): regra v1 desde a ativação; plano "anterior"
 * aprovado no dia −7 (troca a oferta da faixa B + reativação simulada); plano "atual" proposto para a demo aprovar.
 * Os planos são fixos (texto com referências), com os fatos tirados da própria simulação (snapshot).
 */
import { and, eq, isNull } from "drizzle-orm";
import { benefitVersions, benefits, weeklyPlans } from "@/src/db/schema";
import { unitCost } from "@/src/modules/beneficios/domain/offers";
import { loadContext } from "@/src/modules/salao/application/context";
import { simulate, VITRINE_SIM, type SimConvitePeriod, type SimOutput } from "@/src/modules/simulacao/domain/generator";
import { persistSimulation } from "@/src/modules/simulacao/application/persist";
import { planContentSchema, type PlanContent } from "@/src/modules/planos/domain/plan-content";
import { verdict, verdictInputs, type Verdict } from "@/src/modules/analytics/domain/verdict";
import { issuedFactKey, learnedTemplate, usageFactKey } from "@/src/modules/planos/domain/plan-facts";
import { daySP } from "@/src/shared/tz";
import { addDaysSP, dayDiff, instantSP, weekKeyOfDay, weekdayOfDay } from "@/src/shared/week";
import type { VitrineHistory } from "./index";
import { VITRINE_TOKENS } from "./vitrine";

type Facts = Record<string, number>;

function factsFor(out: SimOutput, from: string, to: string, slotA: string, slotB: string): Facts {
  const ck = out.checkins.filter((c) => c.day >= from && c.day < to);
  const inv = out.invites.filter((i) => i.arm === "convidavel" && i.issuedDay >= from && i.issuedDay < to);
  const usedPct = (slot: string) => {
    const xs = inv.filter((i) => i.slot.id === slot);
    return xs.length ? Math.round((100 * xs.filter((i) => i.status === "usado").length) / xs.length) : 0;
  };
  return {
    checkins_30d: ck.length,
    checkins_tarde_terqui: ck.filter((c) => c.turn === "tarde" && [2, 3, 4].includes(weekdayOfDay(c.day))).length,
    checkins_noite_segqua: ck.filter((c) => c.turn === "noite" && [1, 2, 3].includes(weekdayOfDay(c.day))).length,
    convites_A_emitidos: inv.filter((i) => i.slot.id === slotA).length,
    convites_A_usados_pct: usedPct(slotA),
    convites_B_emitidos: inv.filter((i) => i.slot.id === slotB).length,
    convites_B_usados_pct: usedPct(slotB),
    clientes_30d: new Set(ck.map((c) => c.customerId)).size,
  };
}

/** Veredito do código por versão de convite (D220; SEED_VERSION 3: planos fixos coerentes com `verdict()` — revisão do plano S3). */
function offerVerdict(out: SimOutput, versionId: string, refDay: string): { v: Verdict; facts: { used: number; issued: number; pct: number } } {
  const inv = out.invites.filter((i) => i.versionId === versionId && i.arm === "convidavel").map((i) => ({ issuedDay: i.issuedDay, usedDay: i.usedAt ? daySP(i.usedAt) : null }));
  const x = verdictInputs(inv, refDay, addDaysSP);
  return { v: verdict(x), facts: { used: x.used7d, issued: x.issued7d, pct: x.issued7d ? Math.round((100 * x.used7d) / x.issued7d) : 0 } };
}

/**
 * Histórico da vitrine. Na cópia por conta (D119): simula com o id da vitrine original (mesmos grupos e números),
 * tokens com sufixo e ids remapeados ao gravar (revisão T-B1).
 */
export function makeVitrineHistory(o: { simRestaurantId?: string; tokenSuffix?: string; idScope?: string } = {}): VitrineHistory {
  return (tx, p) => buildHistory(tx, p, o);
}

export const vitrineHistory: VitrineHistory = makeVitrineHistory();

async function buildHistory(tx: Parameters<VitrineHistory>[0], { restaurantId, runId, now }: Parameters<VitrineHistory>[1], o: { simRestaurantId?: string; tokenSuffix?: string; idScope?: string }) {
  const ctx = (await loadContext(tx, restaurantId))!;
  const today = daySP(now);
  const startDay = addDaysSP(today, -60);
  const switchDay = addDaysSP(today, -7);
  const [slotA, slotB] = ctx.slots as [(typeof ctx.slots)[0], (typeof ctx.slots)[0]];
  const item = (name: string) => ctx.menu.find((m) => m.name === name)!.id;
  const margin = ctx.restaurant.marginPct ?? undefined;
  const cost = (kind: "doce_gratis" | "entrada_gratis", itemId: string) => unitCost({ kind, params: { itemId } }, ctx.menu, margin).cents;

  // Plano anterior (aprovado no dia −7, troca B: Bruschetta → Arancini) e plano atual (proposto: B → Fritto misto).
  const [anterior] = await tx
    .insert(weeklyPlans)
    .values({
      restaurantId,
      weekKey: weekKeyOfDay(switchDay),
      status: "aprovado",
      facts: {},
      candidates: [],
      choices: [],
      texts: {},
      learned: [],
      approvedAt: instantSP(switchDay, 9 * 60),
      approvedVia: "portal",
      createdAt: instantSP(addDaysSP(switchDay, -1), 18 * 60),
      simulationRunId: runId,
    })
    .returning({ id: weeklyPlans.id });
  const [atual] = await tx
    .insert(weeklyPlans)
    .values({ restaurantId, weekKey: weekKeyOfDay(today), status: "proposto", facts: {}, candidates: [], choices: [], texts: {}, learned: [], createdAt: instantSP(addDaysSP(today, -1), 18 * 60), simulationRunId: runId })
    .returning({ id: weeklyPlans.id });

  const vA = ctx.convites[slotA.id]!;
  const vB1 = ctx.convites[slotB.id]!;
  const [benefitB] = await tx.select({ id: benefits.id }).from(benefits).where(and(eq(benefits.restaurantId, restaurantId), eq(benefits.slotId, slotB.id)));
  const switchAt = instantSP(switchDay, 9 * 60);
  await tx.update(benefitVersions).set({ supersededAt: switchAt }).where(and(eq(benefitVersions.id, vB1.versionId), isNull(benefitVersions.supersededAt)));
  const arancini = item("Arancini");
  const [vB2] = await tx
    .insert(benefitVersions)
    .values({ benefitId: benefitB!.id, restaurantId, version: 2, kind: "entrada_gratis", params: { itemId: arancini }, weeklyCap: vB1.weeklyCap, planId: anterior!.id, validFrom: switchAt, inviteText: `Volte {horario:${slotB.id}} e ganhe {oferta} para petiscar.` })
    .returning({ id: benefitVersions.id });

  const periods: SimConvitePeriod[] = [
    { slotId: slotA.id, versionId: vA.versionId, itemId: vA.offer.params.itemId, unitCostCents: cost("doce_gratis", vA.offer.params.itemId), cap: vA.weeklyCap!, fromDay: startDay, toDay: null },
    { slotId: slotB.id, versionId: vB1.versionId, itemId: vB1.offer.params.itemId, unitCostCents: cost("entrada_gratis", vB1.offer.params.itemId), cap: vB1.weeklyCap!, fromDay: startDay, toDay: switchDay },
    { slotId: slotB.id, versionId: vB2!.id, itemId: arancini, unitCostCents: cost("entrada_gratis", arancini), cap: vB1.weeklyCap!, fromDay: switchDay, toDay: null },
  ];
  const simParams = { ...VITRINE_SIM, startDay, days: dayDiff(startDay, today), reactivation: { day: switchDay, minute: 10 * 60, planKey: "anterior" } };
  const out = simulate(
    {
      id: o.simRestaurantId ?? restaurantId,
      slots: ctx.slots,
      agora: { versionId: ctx.agora!.versionId, itemId: ctx.agora!.offer.params.itemId },
      recompensa: { versionId: ctx.recompensa!.versionId, itemId: ctx.recompensa!.offer.params.itemId },
      convites: periods,
      variantTokens: VITRINE_TOKENS.map((t) => (o.tokenSuffix ? `${t}-${o.tokenSuffix}` : t)),
    },
    simParams,
  );

  const A = slotA.id;
  const B = slotB.id;
  const vAnt = { A: offerVerdict(out, vA.versionId, switchDay), B: offerVerdict(out, vB1.versionId, switchDay) };
  const vAtual = { A: offerVerdict(out, vA.versionId, today), B: offerVerdict(out, vB2!.id, today) };
  const verdictFacts = (x: typeof vAnt) => ({
    [usageFactKey("A")]: x.A.facts.pct,
    [issuedFactKey("A")]: x.A.facts.issued,
    [usageFactKey("B")]: x.B.facts.pct,
    [issuedFactKey("B")]: x.B.facts.issued,
  });
  const plans: Array<[string, PlanContent]> = [
    [
      anterior!.id,
      {
        version: 1,
        facts: { ...factsFor(out, addDaysSP(switchDay, -30), switchDay, A, B), ...verdictFacts(vAnt) },
        candidates: [
          { slotId: A, options: [{ id: "A1", offer: { kind: "doce_gratis", itemId: item("Cannoli") }, score: 0.82, unitCostCents: cost("doce_gratis", item("Cannoli")), weeklyCap: vA.weeklyCap! }] },
          {
            slotId: B,
            options: [
              { id: "B1", offer: { kind: "entrada_gratis", itemId: item("Bruschetta") }, score: 0.55, unitCostCents: cost("entrada_gratis", item("Bruschetta")), weeklyCap: vB1.weeklyCap! },
              { id: "B2", offer: { kind: "entrada_gratis", itemId: arancini }, score: 0.71, unitCostCents: cost("entrada_gratis", arancini), weeklyCap: vB1.weeklyCap! },
            ],
          },
        ],
        choices: [
          { slotId: A, candidateId: "A1", textoConvite: "Volte {horario:" + A + "} e ganhe {oferta}: o doce da casa com o seu café.", justificativa: "A tarde de terça a quinta teve só {fato:checkins_tarde_terqui} em 30 dias, e sobremesa combina com o café da tarde." },
          { slotId: B, candidateId: "B2", textoConvite: "Volte {horario:" + B + "} e ganhe {oferta} para petiscar.", justificativa: "A noite de segunda a quarta teve {fato:checkins_noite_segqua} em 30 dias; uma porção para dividir chama mais a mesa no fim do dia." },
        ],
        order: [A, B],
        learned: [
          { ofertaKey: `${A}:v1`, verdict: vAnt.A.v, texto: learnedTemplate(vAnt.A.v, "A", A) },
          { ofertaKey: `${B}:v1`, verdict: vAnt.B.v, texto: learnedTemplate(vAnt.B.v, "B", B) },
        ],
        generatedBy: "fixo",
      },
    ],
    [
      atual!.id,
      {
        version: 1,
        facts: { ...factsFor(out, addDaysSP(today, -30), today, A, B), ...verdictFacts(vAtual) },
        candidates: [
          { slotId: A, options: [{ id: "A1", offer: { kind: "doce_gratis", itemId: item("Cannoli") }, score: 0.84, unitCostCents: cost("doce_gratis", item("Cannoli")), weeklyCap: vA.weeklyCap! }] },
          {
            slotId: B,
            options: [
              { id: "B2", offer: { kind: "entrada_gratis", itemId: arancini }, score: 0.6, unitCostCents: cost("entrada_gratis", arancini), weeklyCap: vB1.weeklyCap! },
              { id: "B3", offer: { kind: "entrada_gratis", itemId: item("Fritto misto") }, score: 0.68, unitCostCents: cost("entrada_gratis", item("Fritto misto")), weeklyCap: vB1.weeklyCap! },
            ],
          },
        ],
        choices: [
          { slotId: A, candidateId: "A1", textoConvite: "Volte {horario:" + A + "} e ganhe {oferta}: a tarde fica mais doce.", justificativa: "A tarde de terça a quinta teve {fato:checkins_tarde_terqui} em 30 dias, e um doce combina com o café da tarde: é a única sobremesa válida para esta faixa." },
          { slotId: B, candidateId: "B3", textoConvite: "Volte {horario:" + B + "} e ganhe {oferta} para a mesa.", justificativa: "A noite de segunda a quarta teve {fato:checkins_noite_segqua} em 30 dias; uma porção maior para dividir tende a trazer grupos no fim do dia." },
        ],
        order: [A, B],
        learned: [
          { ofertaKey: `${A}:v1`, verdict: vAtual.A.v, texto: learnedTemplate(vAtual.A.v, "A", A) },
          { ofertaKey: `${B}:v2`, verdict: vAtual.B.v, texto: learnedTemplate(vAtual.B.v, "B", B) },
        ],
        generatedBy: "fixo",
      },
    ],
  ];
  for (const [id, content] of plans) {
    const c = planContentSchema.parse(content);
    await tx
      .update(weeklyPlans)
      .set({ facts: c.facts, candidates: c.candidates, choices: c.choices, texts: { order: c.order, generatedBy: c.generatedBy, version: c.version }, learned: c.learned })
      .where(eq(weeklyPlans.id, id));
  }

  await persistSimulation(tx, { restaurantId, runId, out, planIdBySendKey: { anterior: anterior!.id }, now, params: simParams, idScope: o.idScope });
}
