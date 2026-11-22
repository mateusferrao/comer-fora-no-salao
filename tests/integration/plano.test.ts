import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { benefitVersions, invites, ownerEdits, planSends, weeklyPlans, customerMessages } from "@/src/db/schema";
import { seedAll } from "@/src/db/seed";
import { vitrineHistory } from "@/src/db/seed/history";
import { VITRINE_ID, VITRINE_OWNER_ID } from "@/src/db/seed/vitrine";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { generateWeeklyPlan } from "@/src/modules/planos/application/generate-plan";
import { approvePlan, discardPlan, latestPlan, type FinalPlan } from "@/src/modules/planos/application/approve-plan";
import { getPlanInsights } from "@/src/modules/planos/application/insights";
import { fixedClock } from "@/src/shared/clock";
import { resetDb } from "./helpers/db";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { setFlag } from "@/src/modules/config/application/app-config";
import { markPlanReviewing, reviewPlan } from "@/src/modules/planos/application/review-plan";

const NOW = new Date("2026-11-23T20:10:00Z"); // segunda 17h10 em SP

/** IA falsa (modo plano): 1ª candidata de cada faixa, textos só com referências e "o que aprendemos" para cada oferta. */
let calls = 0;
let lastText = "";
const fakeGateway: AiGateway = {
  async generate(req) {
    calls++;
    const text = "text" in req.input ? req.input.text : "";
    lastText = text;
    const faixas = [...text.matchAll(/^Faixa ([A-H]):/gm)].map((m) => m[1]!);
    const ofertas = [...text.matchAll(/^ {2}- (O\d+): faixa ([A-H])/gm)].map((m) => ({ o: m[1]!, f: m[2]! }));
    return {
      output: {
        escolhas: faixas.map((f) => ({ faixa: f, candidata: `${f}1`, textoConvite: `Volte {horario:${f}} e aproveite {oferta}.`, justificativa: `A faixa está {fato:faixa_${f}_intensidade}.` })),
        ordem: [...faixas].reverse(),
        aprendemos: ofertas.map(({ o, f }) => ({ ofertaKey: o, texto: `Em {horario:${f}}, {fato:uso7d_${f}_pct} dos convites foram usados em uma semana.` })),
      },
      usage: { inTokens: 100, outTokens: 50, costUsd: 0.0001 },
      model: "fake/modelo",
    };
  },
};
const failing: AiGateway = { generate: async () => Promise.reject(Object.assign(new Error("indisponível"), { kind: "unavailable" })) };

function finalFrom(plan: NonNullable<Awaited<ReturnType<typeof latestPlan>>>, cap?: number): FinalPlan {
  const cands = plan.candidates as Array<{ slotId: string; options: Array<{ id: string; offer: { kind: "doce_gratis"; itemId: string }; weeklyCap: number }> }>;
  const choices = plan.choices as Array<{ slotId: string; candidateId: string; textoConvite: string }>;
  return {
    slots: choices.map((c) => {
      const o = cands.find((x) => x.slotId === c.slotId)!.options.find((x) => x.id === c.candidateId)!;
      return { slotId: c.slotId, offer: o.offer, weeklyCap: cap ?? o.weeklyCap, inviteText: c.textoConvite };
    }),
  };
}

describe("plano da semana (S3 §4.3–4.4)", () => {
  beforeEach(async () => {
    await resetDb();
    await seedAll(getDb(), fixedClock(NOW.toISOString()), vitrineHistory);
    // Revisor (ligado por padrão — D148) só nos testes dele, com gateway falso.
    await setFlag(getDb(), "revisor", false);
    // Estes testes medem a chamada única (o agente — D225 — tem o próprio teste em plan-agent.test.ts).
    await setFlag(getDb(), "plano_agente", false);
    calls = 0;
  }, 120_000);
  afterAll(closeDb);

  it("gerar com IA: proposto, escolhas válidas, 'o que aprendemos' com o veredito do código e teto recalibrado", async () => {
    const ins = (await getPlanInsights(getDb(), VITRINE_ID, NOW))!;
    expect(ins.offers.length).toBe(2);
    expect(ins.facts.checkins_30d).toBeGreaterThan(0);
    const r = await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: fakeGateway });
    expect(r).toMatchObject({ ok: true, generatedBy: "ia" });
    const p = (await latestPlan(getDb(), VITRINE_ID))!;
    expect(p.status).toBe("proposto");
    const learned = p.learned as Array<{ ofertaKey: string; verdict: string; texto: string }>;
    expect(learned.map((l) => [l.ofertaKey, l.verdict])).toEqual(ins.offers.map((o) => [o.key, o.verdict]));
    expect(learned.every((l) => !/\{horario:[A-H]\}/.test(l.texto))).toBe(true); // apelidos resolvidos para ids
    const d = p.decision as { caps: Record<string, number>; aiChoices: unknown[]; topScore: Record<string, string> };
    for (const o of ins.offers) expect(d.caps[o.slotId]).toBe(o.recalibratedCap);
    expect(d.aiChoices).toHaveLength(2);
    // ordem da IA respeitada
    expect((p.texts as { order: string[] }).order).toEqual([...ins.ctx.slots].sort((a, b) => (a.intensity === "muito" ? -1 : 1) - (b.intensity === "muito" ? -1 : 1)).map((s) => s.id).reverse());
  });

  it("IA indisponível → texto modelo (sem IA) com 'o que aprendemos' por modelo; clique duplo → 1 chamada", async () => {
    expect(await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: failing })).toMatchObject({ ok: true, generatedBy: "sem_ia" });
    const p = (await latestPlan(getDb(), VITRINE_ID))!;
    expect((p.texts as { generatedBy: string }).generatedBy).toBe("sem_ia");
    expect((p.learned as unknown[]).length).toBe(2);
    expect((p.choices as Array<{ justificativa: string }>).every((c) => c.justificativa.length > 0)).toBe(true);
    const slow: AiGateway = { generate: async (req) => { await new Promise((r) => setTimeout(r, 150)); return fakeGateway.generate(req); } };
    calls = 0;
    const [a, b] = await Promise.all([
      generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: slow }),
      generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: slow }),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(calls).toBe(1);
  });

  it("aprovar: versão nova com plan_id, reativação dentro da cota de 50%, fantasma para o holdout, 2× → 1 envio", async () => {
    await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: fakeGateway });
    const p = (await latestPlan(getDb(), VITRINE_ID))!;
    const final = finalFrom(p, 30);
    const r1 = await approvePlan(getDb(), { restaurantId: VITRINE_ID, planId: p.id, final, via: "portal", now: NOW });
    expect(r1).toMatchObject({ ok: true, already: false });
    if (!r1.ok) return;
    expect(r1.sent.real).toBeLessThanOrEqual(15 * final.slots.length); // ≤ 50% de 30 por faixa
    const v = await getDb().select().from(benefitVersions).where(eq(benefitVersions.planId, p.id));
    expect(v.length).toBeGreaterThan(0);
    const reat = await getDb().select().from(invites).where(and(eq(invites.restaurantId, VITRINE_ID), eq(invites.origin, "reativacao"), sql`${invites.issuedAt} = ${NOW.toISOString()}`));
    expect(reat.filter((i) => i.arm === "convidavel").length).toBe(r1.sent.real);
    expect(reat.filter((i) => i.arm === "holdout").every((i) => i.status === "suprimido")).toBe(true);
    // S4.4 (D155): cada convite real vira mensagem no app; o holdout não recebe nada.
    const msgs = await getDb().select().from(customerMessages).where(eq(customerMessages.restaurantId, VITRINE_ID));
    expect(msgs.filter((m) => m.kind === "reativacao")).toHaveLength(r1.sent.real);
    const holdoutIds = new Set(reat.filter((i) => i.arm === "holdout").map((i) => i.id));
    expect(msgs.some((m) => m.inviteId && holdoutIds.has(m.inviteId))).toBe(false);
    if (r1.ok && !r1.already) expect(r1.inviteIds).toHaveLength(r1.sent.real);
    const r2 = await approvePlan(getDb(), { restaurantId: VITRINE_ID, planId: p.id, final, via: "portal", now: NOW });
    expect(r2).toMatchObject({ ok: true, already: true, sent: { real: r1.sent.real, fantasma: r1.sent.fantasma } });
    expect(await getDb().select().from(planSends).where(eq(planSends.planId, p.id))).toHaveLength(1);
    expect((await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.id, p.id)))[0]!.approvedVia).toBe("portal");
    expect((await getDb().select().from(ownerEdits).where(eq(ownerEdits.restaurantId, VITRINE_ID))).some((e) => e.kind.startsWith("plano:"))).toBe(true);
  });

  it("reativação: frequentes e quem já tem convite ativo ficam fora; via agente registrada", async () => {
    const p = (await latestPlan(getDb(), VITRINE_ID))!; // plano fixo "Exemplo pronto" da vitrine
    const r = await approvePlan(getDb(), { restaurantId: VITRINE_ID, planId: p.id, final: finalFrom(p), via: "agente", now: NOW });
    expect(r.ok).toBe(true);
    const members = (await getDb().execute(sql`
      select count(*)::int n from plan_send_members m join plan_sends s on s.id = m.send_id
      where s.plan_id = ${p.id} and (select count(*) from checkins c where c.restaurant_id = ${VITRINE_ID} and c.customer_id = m.customer_id and c.day_sp >= '2026-10-25') >= 3`)) as unknown as { rows: Array<{ n: number }> };
    expect(members.rows[0]!.n).toBe(0);
    const dup = (await getDb().execute(sql`select count(*)::int n from (select customer_id from invites where restaurant_id = ${VITRINE_ID} and status in ('ativo','suprimido') group by customer_id having count(*) > 1) x`)) as unknown as { rows: Array<{ n: number }> };
    expect(dup.rows[0]!.n).toBe(0);
    expect((await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.id, p.id)))[0]!.approvedVia).toBe("agente");
  });

  it("descartar com motivo; não dá para aprovar depois", async () => {
    const p = (await latestPlan(getDb(), VITRINE_ID))!;
    expect(await discardPlan(getDb(), { restaurantId: VITRINE_ID, planId: p.id, reason: "teto", now: NOW })).toEqual({ ok: true });
    expect(await approvePlan(getDb(), { restaurantId: VITRINE_ID, planId: p.id, final: finalFrom(p), via: "portal", now: NOW })).toMatchObject({ ok: false, erro: "nao_proposto" });
  });

  it("aprende (flag): texto do dono que passa no guard vira exemplo de estilo; com dígito, não; desligado, nada", async () => {
    const slots = (await getDb().execute(sql`select id from idle_slots where restaurant_id = ${VITRINE_ID} order by position`)) as unknown as { rows: Array<{ id: string }> };
    const sid = slots.rows[0]!.id;
    await getDb().insert(ownerEdits).values([
      { restaurantId: VITRINE_ID, kind: "plano:convite_texto", ref: sid, suggested: null, final: `Te esperamos {horario:${sid}} com {oferta}, do jeito da nonna.`, at: new Date(NOW.getTime() - 60_000) },
      { restaurantId: VITRINE_ID, kind: "plano:convite_texto", ref: sid, suggested: null, final: "Volte em 2 dias e ganhe 50% off", at: NOW },
    ]);
    await setFlag(getDb(), "aprende", false);
    await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: fakeGateway });
    expect(lastText).not.toContain("do jeito da nonna");
    await setFlag(getDb(), "aprende", true);
    await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: new Date(NOW.getTime() + 1000), gateway: fakeGateway });
    expect(lastText).toContain("«Te esperamos {horario} com {oferta}, do jeito da nonna.»");
    expect(lastText).not.toContain("50%");
    const calls2 = (await getDb().execute(sql`select prompt_version from ai_calls where task = 'plano' order by at desc limit 1`)) as unknown as { rows: Array<{ prompt_version: string }> };
    expect(calls2.rows[0]!.prompt_version).toMatch(/\+ex$/);
  });

  it("S5: as chamadas de IA do plano e do revisor ficam ligadas ao plano (ai_calls.plan_id)", async () => {
    const g = await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: fakeGateway });
    if (!g.ok) throw new Error("não gerou");
    const ok: AiGateway = { generate: async () => ({ output: { veredito: "ok", motivos: [] }, usage: { inTokens: 5, outTokens: 5 }, model: "fake-revisor" }) };
    await reviewPlan(getDb(), { restaurantId: VITRINE_ID, planId: g.planId, now: NOW, gateway: ok });
    const rows = (await getDb().execute(sql`select task, plan_id from ai_calls where restaurant_id = ${VITRINE_ID} order by at`)) as unknown as { rows: Array<{ task: string; plan_id: string | null }> };
    expect(rows.rows.filter((r) => r.task === "plano").map((r) => r.plan_id)).toEqual([g.planId]);
    expect(rows.rows.filter((r) => r.task === "revisor").map((r) => r.plan_id)).toEqual([g.planId]);
  });

  it("S5.3 'Por que esta oferta?': opções com nota, escolha da IA, fatos usados e a tentativa bloqueada antes do modelo reserva", async () => {
    let n = 0;
    const blocksFirst: AiGateway = {
      async generate(req) {
        n++;
        const r = await fakeGateway.generate(req);
        if (n === 1) {
          const out = r.output as { escolhas: Array<{ textoConvite: string }> };
          out.escolhas[0]!.textoConvite = "Volte e ganhe grátis {oferta}.";
        }
        return { ...r, model: n === 1 ? "fake/principal" : "fake/reserva" };
      },
    };
    const g = await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: blocksFirst });
    if (!g.ok) throw new Error("não gerou");
    const { explainOffer } = await import("@/src/modules/planos/application/explain-offer");
    const plan = (await latestPlan(getDb(), VITRINE_ID))!;
    const slotId = (plan.choices as Array<{ slotId: string }>)[0]!.slotId;
    const e = (await explainOffer(getDb(), VITRINE_ID, g.planId, slotId))!;
    expect(e.kind).toBe("plano");
    expect(e.modo).toBe("ia");
    expect(e.opcoes.length).toBeGreaterThan(0);
    expect(e.opcoes.filter((o) => o.escolhaIa)).toHaveLength(1);
    expect(e.opcoes.filter((o) => o.maiorNota)).toHaveLength(1);
    expect(e.fatos.length).toBeGreaterThan(0);
    expect(e.fatos[0]!.label).toMatch(/: quanto fica vazio$/);
    expect(e.fatos[0]!.label).not.toMatch(/Faixa/); // S9: horário legível ou "Horário vazio A"
    expect(e.justificativa).not.toMatch(/\{fato:/);
    expect(e.tecnico).toMatchObject({ task: "plano", reserva: true, promptVersion: expect.stringMatching(/^plano-v/) });
    expect(e.tecnico!.attempts[0]).toMatchObject({ ok: false, error: "guard" });
    expect(e.tecnico!.attempts[0]!.notes.some((x) => x.includes("proibida"))).toBe(true);
    // Outro restaurante (ou plano de outro restaurante): nada.
    expect(await explainOffer(getDb(), "00000000-0000-4000-8000-000000000000", g.planId, slotId)).toBeNull();
  });

  it("S5.3: o plano pronto do restaurante de exemplo é declarado 'fixo', sem chamada de IA", async () => {
    const { explainOffer } = await import("@/src/modules/planos/application/explain-offer");
    const [fixed] = await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.restaurantId, VITRINE_ID)).limit(1);
    const slotId = (fixed!.choices as Array<{ slotId: string }>)[0]!.slotId;
    const e = (await explainOffer(getDb(), VITRINE_ID, fixed!.id, slotId))!;
    expect(e.modo).toBe("fixo");
    expect(e.tecnico).toBeNull();
  });

  it("revisor (flag) no plano: revisando/bloquear seguram a aprovação; convite reescrito pelo dono libera", async () => {
    const g = await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: fakeGateway });
    if (!g.ok) throw new Error("não gerou");
    const plan = (await latestPlan(getDb(), VITRINE_ID))!;
    await markPlanReviewing(getDb(), g.planId, NOW);
    expect(await approvePlan(getDb(), { restaurantId: VITRINE_ID, planId: g.planId, final: finalFrom(plan), via: "portal", now: NOW })).toMatchObject({ ok: false, erro: "revisor" });
    const block: AiGateway = { generate: async () => ({ output: { veredito: "bloquear", motivos: ["Convite promete mais que a oferta."] }, usage: { inTokens: 5, outTokens: 5 }, model: "fake-revisor" }) };
    expect(await reviewPlan(getDb(), { restaurantId: VITRINE_ID, planId: g.planId, now: NOW, gateway: block })).toMatchObject({ status: "bloquear" });
    const later = new Date(NOW.getTime() + 60_000);
    expect(await approvePlan(getDb(), { restaurantId: VITRINE_ID, planId: g.planId, final: finalFrom(plan), via: "portal", now: later })).toMatchObject({ ok: false, erro: "revisor" });
    const f = finalFrom(plan);
    // Reescrever só um convite não basta (D148: o dono assume os textos que reescreveu).
    f.slots[0]!.inviteText = "Te esperamos com {oferta}.";
    expect(await approvePlan(getDb(), { restaurantId: VITRINE_ID, planId: g.planId, final: f, via: "portal", now: later })).toMatchObject({ ok: false, erro: "revisor" });
    for (const sl of f.slots) sl.inviteText = "Te esperamos com {oferta}.";
    expect(await approvePlan(getDb(), { restaurantId: VITRINE_ID, planId: g.planId, final: f, via: "portal", now: later })).toMatchObject({ ok: true });
  });

  it("proposta de domingo aprovada na segunda vale para a semana da aprovação; convites vencidos 'ativos' vencem na aprovação", async () => {
    const sunday = new Date("2026-11-23T02:50:00Z"); // domingo 22/11, 23h50 em SP
    const g = await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: sunday, gateway: fakeGateway });
    if (!g.ok) throw new Error("não gerou");
    const staleRes = (await getDb().execute(sql`update invites set expires_at = ${new Date(NOW.getTime() - 86_400_000)} where id = (select id from invites where restaurant_id = ${VITRINE_ID} and status = 'ativo' limit 1) returning id`)) as unknown as { rows: Array<{ id: string }> };
    const plan = (await latestPlan(getDb(), VITRINE_ID))!;
    expect(plan.weekKey).toBe("2026-W47");
    expect(await approvePlan(getDb(), { restaurantId: VITRINE_ID, planId: g.planId, final: finalFrom(plan), via: "portal", now: NOW })).toMatchObject({ ok: true });
    const [row] = await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.id, g.planId));
    expect(row!.weekKey).toBe("2026-W48");
    const staleId = staleRes.rows[0]?.id;
    if (staleId) {
      const [inv] = await getDb().select().from(invites).where(eq(invites.id, staleId));
      expect(inv!.status).toBe("expirado");
    }
  });

  it("check-in simultâneo à aprovação: os dois terminam (sem deadlock nem erro 500)", async () => {
    const g = await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: fakeGateway });
    if (!g.ok) throw new Error("não gerou");
    const plan = (await latestPlan(getDb(), VITRINE_ID))!;
    const cust = (await getDb().execute(sql`select customer_id from restaurant_customers where restaurant_id = ${VITRINE_ID} and arm = 'convidavel' and customer_id not in (select customer_id from invites where restaurant_id = ${VITRINE_ID} and status = 'ativo') limit 5`)) as unknown as { rows: Array<{ customer_id: string }> };
    const results = await Promise.all([
      approvePlan(getDb(), { restaurantId: VITRINE_ID, planId: g.planId, final: finalFrom(plan), via: "portal", now: NOW }),
      ...cust.rows.map((c) => doCheckin(getDb(), { restaurantId: VITRINE_ID, customerId: c.customer_id, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock(NOW.toISOString()), randInt: (n: number) => Math.floor(Math.random() * n) })),
    ]);
    expect(results[0]).toMatchObject({ ok: true });
    expect(results.slice(1).every((r) => "outcome" in (r as object))).toBe(true);
  }, 60_000);

  it("veredito olha a oferta vigente no início da semana: aprovar no meio da semana não zera 'o que aprendemos'", async () => {
    const before = (await getPlanInsights(getDb(), VITRINE_ID, NOW))!;
    const g = await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: fakeGateway });
    if (!g.ok) throw new Error("não gerou");
    const plan = (await latestPlan(getDb(), VITRINE_ID))!;
    const f = finalFrom(plan, 7); // teto diferente → versão nova da oferta
    expect(await approvePlan(getDb(), { restaurantId: VITRINE_ID, planId: g.planId, final: f, via: "portal", now: NOW })).toMatchObject({ ok: true });
    const after = (await getPlanInsights(getDb(), VITRINE_ID, new Date(NOW.getTime() + 3_600_000)))!;
    expect(after.offers.map((o) => [o.key, o.verdict])).toEqual(before.offers.map((o) => [o.key, o.verdict]));
  });
});
