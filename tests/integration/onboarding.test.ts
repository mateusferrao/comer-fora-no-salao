import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { planContentFromRow } from "@/src/modules/planos/domain/plan-content";
import { benefitVersions, onboardingEvents, ownerEdits, owners, restaurants, weeklyPlans } from "@/src/db/schema";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { EXAMPLES } from "@/src/modules/onboarding/adapters/example-source";
import { activate, type FinalPackage } from "@/src/modules/onboarding/application/activate";
import { getExtraction, startCachedExtraction } from "@/src/modules/onboarding/application/extract-menu";
import { getPackageView, proposePackage, type PackageView } from "@/src/modules/onboarding/application/package";
import { createTestRestaurant } from "@/src/modules/onboarding/application/test-restaurants";
import { saveMenu, saveSalon } from "@/src/modules/onboarding/application/wizard";
import { resetDb } from "./helpers/db";
import { customers } from "@/src/db/schema";
import { doCheckin } from "@/src/modules/salao/application/do-checkin";
import { assignArm } from "@/src/modules/salao/domain/experiment";
import { fixedClock } from "@/src/shared/clock";

const NOW = new Date("2026-11-21T14:00:00Z");

/** IA falsa: escolhe a 2ª candidata de cada faixa e escreve textos só com referências. */
const fakeGateway: AiGateway = {
  async generate(req) {
    const text = "text" in req.input ? req.input.text : "";
    const faixas = [...text.matchAll(/^Faixa ([A-H]):/gm)].map((m) => m[1]!);
    return {
      output: {
        escolhas: faixas.map((f) => ({ faixa: f, candidata: `${f}2`, textoConvite: `Volte {horario:${f}} e aproveite {oferta}.`, justificativa: `A faixa está {fato:faixa_${f}_intensidade} no turno da {fato:faixa_${f}_turno}.` })),
        ordem: faixas,
        aprendemos: [],
      },
      usage: { inTokens: 100, outTokens: 50, costUsd: 0.0001 },
      model: "fake/modelo",
    };
  },
};

async function setup() {
  const [o] = await getDb().insert(owners).values({ kind: "teste", via: "email", emailHmac: "h1" }).returning({ id: owners.id });
  const c = await createTestRestaurant(getDb(), { ownerId: o!.id, ip: "1.1.1.1", now: NOW });
  if (!c.ok) throw new Error("criar");
  const extId = await startCachedExtraction(getDb(), { restaurantId: c.restaurantId, source: "exemplo", exampleId: "boteco", now: NOW });
  const ext = await getExtraction(getDb(), c.restaurantId, extId, NOW);
  const ex = EXAMPLES.boteco;
  expect((await saveMenu(getDb(), c.restaurantId, { items: ext!.result!.itens, cuisine: ext!.result!.culinaria, priceBand: ext!.result!.faixaPreco, extractionId: extId }, NOW)).ok).toBe(true);
  const salon = await saveSalon(getDb(), c.restaurantId, { name: ex.preset.name, tables: ex.preset.tables, weeklyCustomers: ex.preset.weeklyCustomers, opening: ex.preset.opening, slots: ex.preset.slots, ticketCents: ex.preset.ticketCents, marginPct: ex.preset.marginPct }, NOW);
  expect(salon.ok).toBe(true);
  return { ownerId: o!.id, restaurantId: c.restaurantId };
}

function finalFrom(v: PackageView): FinalPackage {
  return {
    agora: { kind: v.agora.offer.kind, itemId: v.agora.offer.params.itemId },
    recompensa: { kind: v.recompensa.offer.kind, itemId: v.recompensa.offer.params.itemId },
    slots: v.slots.map((s) => {
      const o = s.options.find((x) => x.id === s.chosenId)!;
      return { slotId: s.slotId, offer: { kind: o.offer.kind, itemId: o.offer.params.itemId, pct: o.offer.params.pct }, weeklyCap: s.weeklyCap, inviteText: s.inviteText };
    }),
  };
}

describe("assistente de ativação (Postgres)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("exemplo → salão → pacote com IA → ativar 2× = 1 ativação, 1 plano aprovado e versões v1", async () => {
    const { ownerId, restaurantId } = await setup();
    expect(await proposePackage(getDb(), { restaurantId, ownerId, now: NOW, gateway: fakeGateway })).toMatchObject({ ok: true });
    const v = (await getPackageView(getDb(), restaurantId, NOW)) as PackageView;
    expect(v.generatedBy).toBe("ia");
    expect(v.slots).toHaveLength(2);
    expect(v.slots[0]!.chosenId).toBe(v.slots[0]!.options[1]!.id);
    expect(v.slots[0]!.inviteRendered).toMatch(/^Volte .+, das \d+h às \d+h e aproveite .+\.$/);
    expect(v.slots[0]!.justificativa).toMatch(/muito vazia|um pouco vazia/);
    // o "agora" e a recompensa não aparecem entre as candidatas
    const ids = v.slots.flatMap((s) => s.options.map((o) => o.offer.params.itemId));
    expect(ids).not.toContain(v.agora.offer.params.itemId);
    expect(ids).not.toContain(v.recompensa.offer.params.itemId);

    const fin = finalFrom(v);
    const [a1, a2] = await Promise.all([activate(getDb(), { restaurantId, final: fin, now: NOW }), activate(getDb(), { restaurantId, final: fin, now: NOW })]);
    expect([a1, a2].map((a) => a.ok && a.already).sort()).toEqual([false, true]);
    const [r] = await getDb().select().from(restaurants).where(eq(restaurants.id, restaurantId));
    expect(r!.status).toBe("ativo");
    expect(r!.activatedAt).toEqual(NOW);
    const versions = await getDb().select().from(benefitVersions).where(eq(benefitVersions.restaurantId, restaurantId));
    expect(versions).toHaveLength(4);
    expect(versions.filter((x) => x.inviteText).map((x) => x.inviteText)).toEqual(expect.arrayContaining([expect.stringContaining("{oferta}")]));
    const plans = await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.restaurantId, restaurantId));
    expect(plans.map((p) => p.status)).toEqual(["aprovado"]);
    expect(plans[0]!.approvedVia).toBe("portal");
    // Contrato que a S3 lê (revisão da S2).
    const content = planContentFromRow(plans[0]!);
    expect(content.success, JSON.stringify(content.error?.issues)).toBe(true);
    const edits = await getDb().select().from(ownerEdits).where(eq(ownerEdits.restaurantId, restaurantId));
    expect(edits.map((e) => e.kind)).toEqual(expect.arrayContaining(["cardapio", "pacote:sem_edicao"]));
    // 2º card do cliente convidável: recado aprovado, renderizado com a faixa congelada (D122).
    let customerId = crypto.randomUUID();
    while (assignArm(customerId, restaurantId) !== "convidavel") customerId = crypto.randomUUID();
    await getDb().insert(customers).values({ id: customerId });
    const ck = await doCheckin(getDb(), { restaurantId, customerId, gpsStatus: "negado", variantId: null, idempotencyKey: crypto.randomUUID(), clock: fixedClock("2026-11-21T14:30:00Z"), randInt: (n) => Math.floor(Math.random() * n) });
    const inv = (ck as { invite: { message: string | null } | null }).invite;
    expect(inv?.message).toMatch(/^Volte .+, das \d+h às \d+h e aproveite .+\.$/);
    const ev = await getDb().select().from(onboardingEvents).where(eq(onboardingEvents.restaurantId, restaurantId));
    expect(ev.filter((e) => e.event === "concluiu").map((e) => e.step).sort()).toEqual([2, 3, 5]);
  });

  it("sem IA: maior nota distinta por faixa, texto modelo e rótulo sem_ia; ajuste do dono registrado", async () => {
    const { ownerId, restaurantId } = await setup();
    await proposePackage(getDb(), { restaurantId, ownerId, now: NOW, gateway: null });
    const v = (await getPackageView(getDb(), restaurantId, NOW)) as PackageView;
    expect(v.generatedBy).toBe("sem_ia");
    expect(v.semIa).toBe("sem_chave");
    expect(v.slots[0]!.chosenId).toBe(v.slots[0]!.options[0]!.id);
    expect(v.slots[1]!.chosenId).not.toBe(null);
    expect(v.slots[0]!.inviteText).toBe(`Volte {horario:${v.slots[0]!.slotId}} e aproveite {oferta}.`);
    const fin = finalFrom(v);
    fin.slots[0]!.weeklyCap = 7;
    fin.slots[0]!.inviteText = "Volte na terça e ganhe 50% off!"; // D125: livre, só com aviso
    expect(await activate(getDb(), { restaurantId, final: fin, now: NOW })).toEqual({ ok: true, already: false });
    const edits = await getDb().select().from(ownerEdits).where(eq(ownerEdits.restaurantId, restaurantId));
    expect(edits.map((e) => e.kind)).toEqual(expect.arrayContaining(["pacote:teto", "pacote:convite_texto"]));
    const [plan] = await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.restaurantId, restaurantId));
    expect(planContentFromRow(plan!).success).toBe(true);
  });

  it("recusa: desconto acima de 50%, item de outra categoria e texto com PII", async () => {
    const { ownerId, restaurantId } = await setup();
    await proposePackage(getDb(), { restaurantId, ownerId, now: NOW, gateway: null });
    const v = (await getPackageView(getDb(), restaurantId, NOW)) as PackageView;
    const fin = finalFrom(v);
    const prato = v.slots[0]!.options.find((o) => o.offer.kind === "desconto")?.offer.params.itemId;
    if (prato) {
      const f1 = structuredClone(fin);
      f1.slots[0]!.offer = { kind: "desconto", itemId: prato, pct: 60 };
      expect(await activate(getDb(), { restaurantId, final: f1, now: NOW })).toMatchObject({ ok: false, erro: "oferta" });
    }
    const f2 = structuredClone(fin);
    f2.agora = { kind: "doce_gratis", itemId: v.slots[0]!.options.find((o) => o.offer.kind === "cortesia")?.offer.params.itemId ?? "x" };
    expect(await activate(getDb(), { restaurantId, final: f2, now: NOW })).toMatchObject({ ok: false, erro: "oferta" });
    const f3 = structuredClone(fin);
    f3.slots[0]!.inviteText = "Me chame: dono@exemplo.com";
    expect(await activate(getDb(), { restaurantId, final: f3, now: NOW })).toMatchObject({ ok: false, erro: "texto" });
  });

  it("gerando: clique duplo não gera 2 chamadas", async () => {
    const { ownerId, restaurantId } = await setup();
    let calls = 0;
    const slow: AiGateway = { generate: async (req) => { calls++; await new Promise((r) => setTimeout(r, 200)); return fakeGateway.generate(req); } };
    const [x, y] = await Promise.all([proposePackage(getDb(), { restaurantId, ownerId, now: NOW, gateway: slow }), proposePackage(getDb(), { restaurantId, ownerId, now: NOW, gateway: slow })]);
    expect([x, y].filter((r) => r.ok)).toHaveLength(1);
    expect([x, y].find((r) => !r.ok)).toMatchObject({ erro: "gerando" });
    expect(calls).toBe(1);
  });
});
