import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { seedAll } from "@/src/db/seed";
import { vitrineHistory } from "@/src/db/seed/history";
import { VITRINE_ID } from "@/src/db/seed/vitrine";
import { E2E_SLUG } from "@/src/db/seed/e2e";
import { getDashboard, getFunnel } from "@/src/modules/analytics/application/dashboard";
import { getSegments } from "@/src/modules/analytics/application/customers";
import { getOperations } from "@/src/modules/analytics/application/operations";
import { promoteWinner } from "@/src/modules/kit/application/kit";
import { planContentFromRow } from "@/src/modules/planos/domain/plan-content";
import { verdict, verdictInputs } from "@/src/modules/analytics/domain/verdict";
import { fixedClock } from "@/src/shared/clock";
import { addDaysSP } from "@/src/shared/week";
import { daySP } from "@/src/shared/tz";
import { resetDb } from "./helpers/db";

const NOW = new Date("2026-11-23T20:10:00Z"); // segunda, 17h10 em SP (demo)
const today = daySP(NOW);
const q = async (s: ReturnType<typeof sql>) => ((await getDb().execute(s)) as unknown as { rows: Array<Record<string, unknown>> }).rows;

describe("painel do dono (S3 §4.2) na vitrine semeada", () => {
  beforeAll(async () => {
    await resetDb();
    await seedAll(getDb(), fixedClock(NOW.toISOString()), vitrineHistory);
  }, 120_000);
  afterAll(closeDb);

  it("métrica principal positiva com IC > 0, margem com intervalo e migração calculada", async () => {
    const d = (await getDashboard(getDb(), VITRINE_ID, NOW))!;
    expect(d.metric.inc.state).toBe("positivo");
    if (d.metric.inc.state === "amostra_insuficiente") throw new Error("sem números");
    expect(d.metric.inc.lo).toBeGreaterThan(0);
    expect(d.metric.margin).not.toBeNull();
    expect(d.metric.margin!.lo).toBeLessThanOrEqual(d.metric.margin!.cents);
    expect(d.metric.migration.state).not.toBe("amostra_insuficiente");
    expect(d.restaurant.simulated).toBe(true);
    expect(d.plan?.status).toBe("proposto");
    expect(d.plan?.generatedBy).toBe("fixo");
  });

  it("funil de 30 dias = contagens SQL feitas à mão (convites só da mesa)", async () => {
    const f = await getFunnel(getDb(), VITRINE_ID, today, "30d");
    const from = addDaysSP(today, -29);
    const [m] = await q(sql`select
      (select count(*) from checkins where restaurant_id = ${VITRINE_ID} and day_sp between ${from} and ${today}) ck,
      (select count(*) from invites where restaurant_id = ${VITRINE_ID} and arm = 'convidavel' and origin = 'mesa' and issued_day between ${from} and ${today}) inv,
      (select count(*) from codes where restaurant_id = ${VITRINE_ID} and type = 'convite' and status = 'validado' and valid_day between ${from} and ${today}) val`);
    expect(f.steps.find((s) => s.key === "checkins")!.value).toBe(Number(m!.ck));
    expect(f.steps.find((s) => s.key === "convites")!.value).toBe(Number(m!.inv));
    expect(f.steps.find((s) => s.key === "validados")!.value).toBe(Number(m!.val));
    expect(f.variants.length).toBe(4);
  });

  it("veredito mostrado nos planos fixos = verdict() recalculado (D220, revisão P-B3)", async () => {
    const [p] = await q(sql`select * from weekly_plans where restaurant_id = ${VITRINE_ID} and status = 'proposto'`);
    const plan = planContentFromRow({ facts: p!.facts, candidates: p!.candidates, choices: p!.choices, texts: p!.texts, learned: p!.learned } as never);
    expect(plan.success).toBe(true);
    if (!plan.success) return;
    for (const l of plan.data.learned) {
      const [slotId, v] = l.ofertaKey.split(":") as [string, string];
      const version = Number(v.slice(1));
      const inv = await q(sql`select i.issued_day, i.used_at from invites i join benefit_versions bv on bv.id = i.benefit_version_id join benefits b on b.id = bv.benefit_id
                              where i.restaurant_id = ${VITRINE_ID} and i.arm = 'convidavel' and b.slot_id = ${slotId} and bv.version = ${version}`);
      const x = verdictInputs(inv.map((r) => ({ issuedDay: String(r.issued_day), usedDay: r.used_at ? daySP(new Date(String(r.used_at))) : null })), today, addDaysSP);
      // A simulação vai até ontem e o seed foi gerado "hoje": mesmos dados, mesmo veredito.
      expect(l.verdict).toBe(verdict(x));
    }
  });

  it("restaurante de teste sem dados → amostra insuficiente com quanto falta", async () => {
    const [r] = await q(sql`select id from restaurants where slug = ${E2E_SLUG}`);
    const d = (await getDashboard(getDb(), String(r!.id), NOW))!;
    expect(d.metric.inc.state).toBe("amostra_insuficiente");
    // A13: conta os dois grupos (sem clientes ainda, faltam 30 em cada).
    expect(d.metric.missing).toEqual({ controle: 30, convidados: 30 });
    expect(d.metric.margin).toBeNull();
  });

  it("'Ver minha página' abre pelo QR do display A em uso, como o cliente chega (A9)", async () => {
    const d = (await getDashboard(getDb(), VITRINE_ID, NOW))!;
    const [v] = await q(sql`select r.slug, pv.qr_token from piece_variants pv join kit_pieces kp on kp.id = pv.piece_id join restaurants r on r.id = pv.restaurant_id
                            where pv.restaurant_id = ${VITRINE_ID} and kp.kind = 'display' and pv.label = 'A' and pv.retired_at is null`);
    expect(d.customerPath).toBe(`/r/${String(v!.slug)}?p=${String(v!.qr_token)}`);
    // Sem display de mesa (kit não gerado): a página sem peça.
    const [r] = await q(sql`select id from restaurants where slug = ${E2E_SLUG}`);
    await getDb().execute(sql`delete from kit_pieces where restaurant_id = ${String(r!.id)} and kind = 'display'`);
    expect((await getDashboard(getDb(), String(r!.id), NOW))!.customerPath).toBe(`/r/${E2E_SLUG}`);
  });

  it("segmentos: contagens coerentes, frequentes separados e contato completo fictício no exemplo (D237)", async () => {
    const s = await getSegments(getDb(), VITRINE_ID, NOW, "sumiu");
    expect(s.counts.sumiu.count).toBeGreaterThan(0);
    expect(s.counts.frequente.count).toBeGreaterThan(0);
    expect(s.list.length).toBeLessThanOrEqual(20);
    for (const c of s.list) {
      expect(c.segments).toContain("sumiu");
      expect(c.phone).toMatch(/^\(00\) 9\d{4}-\d{4}$/);
      expect(c.email).toMatch(/@exemplo\.invalid$/);
      expect(c.displayName).toMatch(/^\S+ \S{2,}/);
    }
  });

  it("A/B e alertas (flags): contagens = SQL à mão; promover só com vencedora", async () => {
    const ops = (await getOperations(getDb(), VITRINE_ID, NOW))!;
    const raw = await q(sql`select kp.kind, pv.label, (select count(*) from scans s where s.variant_id = pv.id)::int as sc, (select count(*) from checkins c where c.variant_id = pv.id)::int as ck from piece_variants pv join kit_pieces kp on kp.id = pv.piece_id where pv.restaurant_id = ${VITRINE_ID} and kp.kind <> 'garcom'`);
    for (const r of ops.ab) for (const v of [r.a, r.b]) {
      const m = raw.find((x) => x.kind === r.kind && x.label === v!.label)!;
      expect([v!.scans, v!.checkins]).toEqual([m.sc, m.ck]);
    }
    expect(Array.isArray(ops.alerts)).toBe(true);
    const disp = ops.ab.find((r) => r.kind === "display")!;
    const pr = await promoteWinner(getDb(), { restaurantId: VITRINE_ID, piece: "display", now: NOW });
    expect(pr.ok).toBe(disp.status?.state === "vencedora");
  });
});
