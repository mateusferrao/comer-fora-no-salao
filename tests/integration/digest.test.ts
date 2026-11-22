import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { digestTokens, owners, restaurants, weeklyDigests, weeklyPlans } from "@/src/db/schema";
import { seedAll } from "@/src/db/seed";
import { vitrineHistory } from "@/src/db/seed/history";
import { VITRINE_ID, VITRINE_OWNER_ID } from "@/src/db/seed/vitrine";
import { clearOutbox, memorySender, outbox } from "@/src/modules/contas/adapters/memory-sender";
import { setFlag } from "@/src/modules/config/application/app-config";
import { approveByDigest, buildDigest, digestPage, previewDigest, sendDigestNow, sendWeeklyDigest, stopDigest, stopToken } from "@/src/modules/planos/application/digest";
import { latestPlan } from "@/src/modules/planos/application/approve-plan";
import { startGenerating } from "@/src/modules/planos/application/generating";
import { parseNotifySettings, NOTIFY_DEFAULTS } from "@/src/modules/config/domain/notify-settings";
import { encryptEmail } from "@/src/shared/crypto";
import { fixedClock } from "@/src/shared/clock";
import { resetDb } from "./helpers/db";

const NOW = new Date("2026-11-23T11:30:00Z"); // segunda 08:30 em SP
const BASE = "https://app.exemplo";
const tokenOf = (url: string | null) => url!.split("/parceiro/aprovar/")[1]!;

async function withOwnerEmail(email = "dona@exemplo.com") {
  await getDb().update(owners).set({ emailEnc: encryptEmail(email), emailHint: "d•••@e•••.com" }).where(eq(owners.id, VITRINE_OWNER_ID));
}
async function freshToken() {
  const d = (await buildDigest(getDb(), { restaurantId: VITRINE_ID, now: NOW, baseUrl: BASE, withToken: true }))!;
  return d;
}

describe("resumo semanal + 'Revisar e aprovar' pelo e-mail (S6.1, D187, D188)", () => {
  beforeEach(async () => {
    await resetDb();
    await seedAll(getDb(), fixedClock(NOW.toISOString()), vitrineHistory);
    await setFlag(getDb(), "revisor", false);
    clearOutbox();
  });
  afterAll(closeDb);

  it("e-mail com o plano proposto e o link; GET não muda nada; POST aprova via e-mail e queima o token", async () => {
    const d = await freshToken();
    expect(d.planId).not.toBeNull();
    // Vitrine com margem a mais certa: o valor vai no assunto (S9, auditoria 1.7).
    expect(d.mail.subject).toMatch(/de margem a mais com os convites · plano para aprovar$/);
    expect(d.mail.text).toContain(`${BASE}/parceiro/aprovar/rv_`);
    const token = d.token!;
    const page = (await digestPage(getDb(), token, NOW))!;
    expect(page.state).toBe("ok");
    expect(page.slots.length).toBeGreaterThan(0);
    expect((await latestPlan(getDb(), VITRINE_ID))!.status).toBe("proposto");

    const r = await approveByDigest(getDb(), { token, now: NOW });
    expect(r.ok).toBe(true);
    const plan = (await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.id, d.planId!)))[0]!;
    expect(plan.status).toBe("aprovado");
    expect(plan.approvedVia).toBe("email");
    expect(await approveByDigest(getDb(), { token, now: NOW })).toEqual({ ok: false, erro: "usado" });
    expect((await digestPage(getDb(), token, NOW))!.state).toBe("usado");
  });

  it("2 aprovações ao mesmo tempo → 1 aprovação e 1 'já usado'", async () => {
    const { token } = await freshToken();
    const rs = await Promise.all([approveByDigest(getDb(), { token: token!, now: NOW }), approveByDigest(getDb(), { token: token!, now: NOW })]);
    expect(rs.filter((x) => x.ok)).toHaveLength(1);
    expect(rs.filter((x) => !x.ok && x.erro === "usado")).toHaveLength(1);
  });

  it("plano gerado de novo no Portal → 'substituído' (a proposta emailed vira vencida, não some)", async () => {
    const { token, planId } = await freshToken();
    const s = await startGenerating(getDb(), { restaurantId: VITRINE_ID, now: NOW, limitKey: "x", limit: 99, exempt: true, clearStatuses: ["gerando", "proposto"] });
    expect(s.ok).toBe(true);
    expect((await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.id, planId!)))[0]!.status).toBe("vencido");
    expect((await digestPage(getDb(), token!, NOW))!.state).toBe("substituido");
    expect(await approveByDigest(getDb(), { token: token!, now: NOW })).toEqual({ ok: false, erro: "substituido" });
  });

  it("revisor bloqueando → recusa e o token continua valendo", async () => {
    const { token, planId } = await freshToken();
    const [p] = await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.id, planId!));
    await getDb().update(weeklyPlans).set({ decision: { ...(p!.decision as object), reviewer: { status: "bloquear", reasons: ["promessa exagerada"], at: NOW.toISOString() } } }).where(eq(weeklyPlans.id, planId!));
    expect((await digestPage(getDb(), token!, NOW))!.state).toBe("revisor");
    expect(await approveByDigest(getDb(), { token: token!, now: NOW })).toEqual({ ok: false, erro: "revisor" });
    const [t] = await getDb().select().from(digestTokens).where(eq(digestTokens.planId, planId!));
    expect(t!.usedAt).toBeNull();
  });

  it("'Aprovar pelo e-mail' desligado: e-mail sem link; token antigo recusado; inválido/expirado → 404", async () => {
    const { token } = await freshToken();
    await getDb().update(restaurants).set({ notifySettings: { ...NOTIFY_DEFAULTS, aprovarEmail: false } }).where(eq(restaurants.id, VITRINE_ID));
    const d = (await buildDigest(getDb(), { restaurantId: VITRINE_ID, now: NOW, baseUrl: BASE, withToken: true }))!;
    expect(d.token).toBeNull();
    expect(d.mail.subject).not.toContain("para aprovar");
    expect(await approveByDigest(getDb(), { token: token!, now: NOW })).toEqual({ ok: false, erro: "desligado" });
    expect(await digestPage(getDb(), "rv_naoexiste_naoexiste_naoexiste_naoexiste_00", NOW)).toBeNull();
    expect(await digestPage(getDb(), "lixo", NOW)).toBeNull();
    expect(await digestPage(getDb(), token!, new Date(NOW.getTime() + 8 * 86_400_000))).toBeNull();
  });

  it("'Não quero mais receber': link assinado desliga só o resumo daquele restaurante", async () => {
    expect((await stopDigest(getDb(), { token: "forjado.abc", now: NOW })).ok).toBe(false);
    const r = await stopDigest(getDb(), { token: stopToken(VITRINE_ID), now: NOW });
    expect(r.ok).toBe(true);
    const [x] = await getDb().select({ s: restaurants.notifySettings }).from(restaurants).where(eq(restaurants.id, VITRINE_ID));
    const s = parseNotifySettings(x!.s);
    expect(s.resumo.on).toBe(false);
    expect(s.planoAuto).toBe(true);
  });

  it("envio do agendador: reserva única por semana; sem e-mail → pulado; 'Enviar agora' até 3/dia; prévia com link", async () => {
    expect(await sendWeeklyDigest(getDb(), { restaurantId: VITRINE_ID, weekKey: "2026-W48", now: NOW, baseUrl: BASE, sender: memorySender })).toBe("pulado");
    await withOwnerEmail();
    expect(await sendWeeklyDigest(getDb(), { restaurantId: VITRINE_ID, weekKey: "2026-W48", now: NOW, baseUrl: BASE, sender: memorySender })).toBe("enviado");
    expect(await sendWeeklyDigest(getDb(), { restaurantId: VITRINE_ID, weekKey: "2026-W48", now: NOW, baseUrl: BASE, sender: memorySender })).toBe("ja");
    expect(outbox().filter((m) => m.to === "dona@exemplo.com")).toHaveLength(1);
    const [w] = await getDb().select().from(weeklyDigests).where(and(eq(weeklyDigests.restaurantId, VITRINE_ID), eq(weeklyDigests.weekKey, "2026-W48")));
    expect(w!.status).toBe("enviado");
    expect(JSON.stringify(outbox().at(-1))).toContain("Revisar e aprovar");

    for (let i = 0; i < 3; i++) expect((await sendDigestNow(getDb(), { restaurantId: VITRINE_ID, now: NOW, baseUrl: BASE, sender: memorySender })).ok).toBe(true);
    expect(await sendDigestNow(getDb(), { restaurantId: VITRINE_ID, now: NOW, baseUrl: BASE, sender: memorySender })).toMatchObject({ ok: false, erro: "limite" });

    const pv = await previewDigest(getDb(), { restaurantId: VITRINE_ID, now: NOW, baseUrl: BASE });
    expect(pv.ok && pv.approveUrl).toMatch(/\/parceiro\/aprovar\/rv_/);
    expect(pv.ok && pv.text).toContain("Semana passada (16/11 a 22/11)");
    // A prévia não grava weekly_digests (só a reserva do agendador existe).
    expect(await getDb().select().from(weeklyDigests)).toHaveLength(1);
    expect(tokenOf(pv.ok ? pv.approveUrl : null).startsWith("rv_")).toBe(true);
  });
});
