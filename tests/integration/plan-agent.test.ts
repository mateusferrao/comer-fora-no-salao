import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { aiCalls, weeklyPlans } from "@/src/db/schema";
import { seedAll } from "@/src/db/seed";
import { vitrineHistory } from "@/src/db/seed/history";
import { VITRINE_ID, VITRINE_OWNER_ID } from "@/src/db/seed/vitrine";
import type { AiGateway, AiGenerateRequest } from "@/src/modules/ia/gateway";
import { generateWeeklyPlan } from "@/src/modules/planos/application/generate-plan";
import { getPlanView } from "@/src/modules/planos/application/plan-view";
import { setFlag } from "@/src/modules/config/application/app-config";
import { fixedClock } from "@/src/shared/clock";
import { resetDb } from "./helpers/db";

const NOW = new Date("2026-11-23T20:10:00Z");

/** Saída válida a partir do texto do prompt (mesmo formato do fake do plano). */
function answer(text: string) {
  const faixas = [...text.matchAll(/^Faixa ([A-H]):/gm)].map((m) => m[1]!);
  const ofertas = [...text.matchAll(/^ {2}- (O\d+): faixa ([A-H])/gm)].map((m) => ({ o: m[1]!, f: m[2]! }));
  return {
    escolhas: faixas.map((f) => ({ faixa: f, candidata: `${f}1`, textoConvite: `Volte {horario:${f}} e aproveite {oferta}.`, justificativa: `A faixa está {fato:faixa_${f}_intensidade}.` })),
    ordem: faixas,
    aprendemos: ofertas.map(({ o, f }) => ({ ofertaKey: o, texto: `Em {horario:${f}}, {fato:uso7d_${f}_pct} dos convites foram usados em uma semana.` })),
  };
}
const usage = { inTokens: 100, outTokens: 50, costUsd: 0.0001 };
let withTools = 0;
let withoutTools = 0;

/** Agente falso: chama as ferramentas de verdade (o código) e devolve os passos, como o gateway real. */
function agentGateway(opts: { agentFails?: boolean } = {}): AiGateway {
  return {
    async generate(req: AiGenerateRequest) {
      const text = "text" in req.input ? req.input.text : "";
      if (req.tools?.length) {
        withTools++;
        if (opts.agentFails) return { output: { escolhas: [] }, usage, model: "fake/agente" };
        const t = Object.fromEntries(req.tools.map((x) => [x.name, x]));
        const steps = [];
        for (const [tool, input] of [["ver_candidatas", { faixa: "A" }], ["ver_fatos", { grupo: "faixas" }], ["custo_semana", { candidata: "A1" }], ["checar_texto", { campo: "textoConvite", faixa: "A", texto: "Volte {horario:A} e aproveite {oferta}." }]] as const) {
          steps.push({ tool, input, output: await t[tool]!.execute(input), ms: 5 });
        }
        return { output: answer(text), usage, model: "fake/agente", steps };
      }
      withoutTools++;
      return { output: answer(text), usage, model: "fake/unica" };
    },
  };
}

describe("plano como agente (S6.3b, D159, D194)", () => {
  beforeEach(async () => {
    await resetDb();
    await seedAll(getDb(), fixedClock(NOW.toISOString()), vitrineHistory);
    await setFlag(getDb(), "revisor", false);
    withTools = 0;
    withoutTools = 0;
  });
  afterAll(closeDb);

  it("agente ok: passos gravados com rótulos, chamada 'plano_agente' registrada, linha visível na vista", async () => {
    const r = await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: agentGateway(), agent: true });
    expect(r).toMatchObject({ ok: true, generatedBy: "ia" });
    expect(withTools).toBe(1);
    expect(withoutTools).toBe(0);
    const [plan] = await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.id, (r as { planId: string }).planId));
    const steps = plan!.agentSteps as Array<{ tool: string; label: string }>;
    expect(steps.map((s) => s.tool)).toEqual(["ver_candidatas", "ver_fatos", "custo_semana", "checar_texto"]);
    expect(steps[0]!.label).toBe("Viu as ofertas possíveis da faixa A");
    const [call] = await getDb().select().from(aiCalls).where(and(eq(aiCalls.planId, plan!.id))).orderBy(desc(aiCalls.at));
    expect(call!.task).toBe("plano_agente");
    const v = (await getPlanView(getDb(), VITRINE_ID, NOW))!;
    expect(v.plan!.agentSteps).toHaveLength(4);
  });

  it("agente falha → cai na chamada única (já medida), sem passos; flag/recurso desligado → sem agente", async () => {
    const r = await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: NOW, gateway: agentGateway({ agentFails: true }), agent: true });
    expect(r).toMatchObject({ ok: true, generatedBy: "ia" });
    expect(withTools).toBeGreaterThan(0);
    expect(withoutTools).toBe(1);
    const [plan] = await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.id, (r as { planId: string }).planId));
    expect(plan!.agentSteps).toBeNull();
    const tasks = (await getDb().select({ t: aiCalls.task }).from(aiCalls).where(eq(aiCalls.planId, plan!.id))).map((x) => x.t).sort();
    expect(tasks).toEqual(["plano", "plano_agente"]);

    withTools = 0;
    withoutTools = 0;
    // Sem `agent`: lê a flag global (ligada por padrão desde a D225); desligada nos Bastidores → sem agente.
    await setFlag(getDb(), "plano_agente", false);
    await generateWeeklyPlan(getDb(), { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now: new Date(NOW.getTime() + 60_000), gateway: agentGateway() });
    expect(withTools).toBe(0);
    expect(withoutTools).toBe(1);
  });
});
