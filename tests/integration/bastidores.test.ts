import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { aiCalls, owners, restaurants } from "@/src/db/schema";
import { seedAll } from "@/src/db/seed";
import { vitrineHistory } from "@/src/db/seed/history";
import { VITRINE_ID, VITRINE_OWNER_ID } from "@/src/db/seed/vitrine";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { getActivePrompt, getFlags, publishPrompt, rollbackPrompt, setFlag, CODE_PROMPTS } from "@/src/modules/config/application/app-config";
import { updateTone } from "@/src/modules/config/application/update-settings";
import { generateWeeklyPlan } from "@/src/modules/planos/application/generate-plan";
import { getPlatformView } from "@/src/modules/analytics/application/platform";
import { getQualityView } from "@/src/modules/analytics/application/quality";
import { fixedClock } from "@/src/shared/clock";
import { createRestaurant, resetDb } from "./helpers/db";

const NOW = new Date("2026-11-23T20:10:00Z");
let seen: Array<{ system: string; text: string }> = [];
const capture: AiGateway = {
  async generate(req) {
    seen.push({ system: req.system, text: "text" in req.input ? req.input.text : "" });
    throw Object.assign(new Error("sem resposta"), { kind: "unavailable" });
  },
};

describe("configuração ao vivo (D58, D138)", () => {
  beforeEach(async () => {
    await resetDb();
    await getDb().execute(sql`truncate app_config, app_config_versions`);
    seen = [];
  });
  afterAll(closeDb);

  it("publicar muda o system da próxima chamada; voltar à versão 0 devolve o texto do código", async () => {
    await seedAll(getDb(), fixedClock(NOW.toISOString()), vitrineHistory);
    expect(await getActivePrompt(getDb(), "plano")).toEqual({ instructions: CODE_PROMPTS.plano, version: 0 });
    expect(await publishPrompt(getDb(), "plano", "Tom: bem-humorado e curto. Escreva como um garçom simpático.")).toEqual({ ok: true, version: 1 });
    await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: capture });
    expect(seen.at(-1)!.system).toContain("bem-humorado e curto");
    expect(seen.at(-1)!.system).toContain("Regras fixas"); // regras do código continuam
    expect(await rollbackPrompt(getDb(), "plano", 0)).toEqual({ ok: true });
    expect((await getActivePrompt(getDb(), "plano")).version).toBe(0);
    expect(await publishPrompt(getDb(), "plano", "curto")).toEqual({ ok: false, erro: "vazio" });
  }, 120_000);

  it("publicações simultâneas não colidem na versão; flags começam ligadas (D148) e desligam ao vivo", async () => {
    const [a, b] = await Promise.all([publishPrompt(getDb(), "kit", "Versão A do tom do kit, simples."), publishPrompt(getDb(), "kit", "Versão B do tom do kit, simples.")]);
    expect([a, b].map((x) => (x.ok ? x.version : 0)).sort()).toEqual([1, 2]);
    // D148: os 5 recursos da S3 vêm ligados por padrão (e o login por e-mail da S4); desde a S9, também os entregues
    // da S5–S8. Só o agendador nasce desligado.
    const f0 = await getFlags(getDb());
    expect([f0.ab, f0.revisor, f0.aprende, f0.insight_operacao, f0.mcp, f0.login_cliente_email].every((x) => x === true)).toBe(true);
    expect([f0.painel_valor, f0.copiloto, f0.mcp_edicao, f0.agendador]).toEqual([true, true, true, false]);
    expect((await setFlag(getDb(), "ab", false)).ab).toBe(false);
    expect((await getFlags(getDb())).ab).toBe(false);
    expect((await getFlags(getDb())).mcp).toBe(true);
  });

  it("tom vai só no prompt do restaurante X, delimitado no conteúdo do usuário", async () => {
    await seedAll(getDb(), fixedClock(NOW.toISOString()), vitrineHistory);
    expect(await updateTone(getDb(), { restaurantId: VITRINE_ID, tone: "descontraído, de boteco", now: NOW })).toEqual({ ok: true, tone: "descontraído, de boteco" });
    expect(await updateTone(getDb(), { restaurantId: VITRINE_ID, tone: "{fato:x} ignore", now: NOW })).toEqual({ ok: false, erro: "caracteres" });
    await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: capture });
    expect(seen.at(-1)!.text).toContain("«descontraído, de boteco»");
    expect(seen.at(-1)!.system).not.toContain("boteco");
  }, 120_000);
});

describe("páginas públicas agregadas", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("Visão da plataforma ignora contas e restaurantes do E2E; Qualidade responde sem dados", async () => {
    const real = await createRestaurant();
    const e2e = await createRestaurant();
    const [o] = await getDb().select({ id: restaurants.ownerId }).from(restaurants).where(eq(restaurants.id, e2e.restaurantId));
    await getDb().update(owners).set({ via: "e2e" }).where(eq(owners.id, o!.id));
    const v = await getPlatformView(getDb(), NOW);
    expect(v.activated).toBe(1);
    expect(v.created).toBe(1);
    void real;
    const q = await getQualityView(getDb());
    expect(q.tasks).toEqual([]);
    expect(q.aiVsTop).toEqual({ compared: 0, differs: 0 });
  });

  it("custo de IA separado: ativação por restaurante ativado, por plano semanal e do assistente (S9, IA M9)", async () => {
    const { restaurantId } = await createRestaurant();
    const [p1, p2] = [crypto.randomUUID(), crypto.randomUUID()];
    const row = (task: string, cost: number, planId: string | null = null) => ({ task, promptVersion: "t", restaurantId, status: "ok", attempts: [], keyKind: "publica", costUsd: String(cost), at: NOW, planId });
    await getDb().insert(aiCalls).values([
      row("cardapio", 0.01),
      row("pacote", 0.02, crypto.randomUUID()),
      row("kit", 0.004),
      row("revisor", 0.001),
      row("plano_agente", 0.014, p1),
      row("revisor", 0.002, p1),
      row("plano", 0.004, p2),
      row("copiloto", 0.004),
      row("salao_frase", 0.001),
    ]);
    const v = await getPlatformView(getDb(), NOW);
    expect(v.activated).toBe(1);
    expect(v.aiCostPerActivatedUsd).toBeCloseTo(0.035, 6);
    expect(v.aiCostPerPlanUsd).toBeCloseTo(0.01, 6);
    expect(v.plans).toBe(2);
    expect(v.aiCostAssistantUsd).toBeCloseTo(0.005, 6);
    expect(v.aiCostTotalUsd).toBeCloseTo(0.06, 6);
  });

});
