/**
 * "Gerar plano da semana" (espec. 3.7; planejamento S3 §4.3–4.4): o código calcula fatos, vereditos, candidatas
 * e teto recalibrado; a IA (tarefa 3, modo plano) escolhe por faixa, escreve o convite, a justificativa e
 * "o que aprendemos". Sem IA: maior nota + textos-modelo, rotulado.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { menuItems, owners, weeklyPlans } from "@/src/db/schema";
import { buildCandidates, fallbackChoices, toPlanCandidate } from "@/src/modules/onboarding/domain/candidates";
import { slotAliases } from "@/src/modules/onboarding/domain/facts";
import { recordAiCall } from "@/src/modules/ia/ai-calls";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { gatewayFor, keyKindFor } from "@/src/modules/ia/gateway-factory";
import { MODELS } from "@/src/modules/ia/models";
import { runTask } from "@/src/modules/ia/run-task";
import { langfuseTracer } from "@/src/modules/ia/tracing";
import { buildPackagePrompt, buildPackageTask, PLAN_PROMPT_VERSION, resolveLearned, resolvePackage } from "@/src/modules/ia/tasks/package";
import { systemClock } from "@/src/shared/clock";
import { getActivePrompt, promptSuffix } from "@/src/modules/config/application/app-config";
import { learnedTemplate, justificationTemplate } from "../domain/plan-facts";
import { startGenerating } from "./generating";
import { getPlanInsights } from "./insights";
import { getFlags } from "@/src/modules/config/application/app-config";
import { ownerExamples } from "@/src/modules/ia/examples";
import { guardText } from "@/src/modules/ia/guardrails";
import { slotPhrase } from "@/src/modules/onboarding/domain/facts";
import { reviewPlan } from "./review-plan";
import { log } from "@/src/shared/log";
import { safeErr } from "@/src/shared/safe-err";

export const PLAN_FALLBACK_INVITE = "Volte {horario} e aproveite {oferta}.";
export const PLAN_LIMIT_PER_DAY = 10;

export type GenerateResult = { ok: true; planId: string; generatedBy: "ia" | "sem_ia" } | { ok: false; erro: "gerando" | "limite" | "inativo" | "nao_encontrado"; retryAfterSec?: number };

/** Decisão gravada no plano (o que o código decidiu + as escolhas originais da IA, para "IA ≠ maior nota"). */
export type WeeklyDecision = {
  mode: "plano";
  semIa?: string;
  caps: Record<string, number>;
  aiChoices: Array<{ slotId: string; candidateId: string }> | null;
  topScore: Record<string, string | null>;
  verdicts: Array<{ ofertaKey: string; verdict: string; slotId: string }>;
};

/** `schedule`: como rodar o revisor depois da resposta (rota e MCP passam `after`); sem ele, roda em seguida. */
type Schedule = (fn: () => Promise<void>) => void;
const inline: Schedule = (fn) => void fn();

export async function generateWeeklyPlan(db: Db, p: { restaurantId: string; ownerId: string; now: Date; gateway?: AiGateway | null; reviewerGateway?: AiGateway | null; schedule?: Schedule; instructions?: string; promptVersionSuffix?: string }): Promise<GenerateResult> {
  const ins = await getPlanInsights(db, p.restaurantId, p.now);
  if (!ins) return { ok: false, erro: "nao_encontrado" };
  const { ctx } = ins;
  if (ctx.restaurant.status !== "ativo" && !ctx.restaurant.copiedFrom) return { ok: false, erro: "inativo" };
  const [owner] = await db.select({ via: owners.via, emailHmac: owners.emailHmac }).from(owners).where(eq(owners.id, p.ownerId));
  const started = await startGenerating(db, { restaurantId: p.restaurantId, now: p.now, limitKey: `plano:${p.restaurantId}`, limit: PLAN_LIMIT_PER_DAY, exempt: owner?.via === "e2e", clearStatuses: ["gerando", "proposto"] });
  if (!started.ok) return started;

  const actives = new Set((await db.select({ id: menuItems.id, active: menuItems.active }).from(menuItems).where(eq(menuItems.restaurantId, p.restaurantId))).filter((m) => m.active).map((m) => m.id));
  const menu = ctx.menu.filter((m) => actives.has(m.id));
  const exclude = [ctx.agora?.offer.params.itemId, ctx.recompensa?.offer.params.itemId].filter((x): x is string => !!x);
  const agoraItem = ctx.agora ? menu.find((m) => m.id === ctx.agora!.offer.params.itemId) : undefined;
  // Teto recalibrado pelo uso real (espec. 3.3): substitui o teto inicial de cada candidata.
  const capBy = Object.fromEntries(ins.offers.map((o) => [o.slotId, o.recalibratedCap]));
  const cands = buildCandidates(ctx.slots, menu, { ticketCents: ctx.restaurant.ticketCents, marginPct: ctx.restaurant.marginPct, exclude, minValueCents: agoraItem?.priceCents }).map((c) => ({
    ...c,
    options: c.options.map((o) => ({ ...o, weeklyCap: capBy[c.slotId] ?? o.weeklyCap })),
  }));
  const prompt = p.instructions ? { instructions: p.instructions, version: -1 } : await getActivePrompt(db, "plano");
  // Aprende (D35, flag): textos de convite do próprio dono que passam no guard em modo `ia`.
  const examples = (await getFlags(db)).aprende
    ? await ownerExamples(db, p.restaurantId, ["plano:convite_texto"], (raw) =>
        guardText(raw, { items: Object.fromEntries(ctx.menu.map((m) => [m.id, m.name])), slots: Object.fromEntries(ctx.slots.map((s) => [s.id, slotPhrase(s)])), oferta: "a oferta" }, { allowed: ["prato", "horario", "oferta"], maxLen: 160, field: "textoConvite", mode: "ia" }).ok,
      )
    : [];
  const pp = buildPackagePrompt({ restaurantName: ctx.restaurant.name, cuisine: ctx.restaurant.cuisine, slots: ctx.slots, cands, menu, facts: ins.facts, learned: ins.learned, instructions: prompt.instructions, tone: ctx.restaurant.aiTone, examples });

  let choices: Array<{ slotId: string; candidateId: string; textoConvite: string; justificativa: string }> | null = null;
  let learned: Array<{ ofertaKey: string; verdict: "manter" | "trocar" | "cedo_demais"; texto: string }> | null = null;
  let semIa: string | undefined;
  let aiOrder: string[] | null = null;
  const allHave = cands.length > 0 && cands.every((c) => c.options.length > 0);
  const keyKind = keyKindFor({ emailHmac: owner?.emailHmac ?? null, via: owner?.via ?? null });
  const gw = p.gateway !== undefined ? { gateway: p.gateway, keyKind, reason: p.gateway ? undefined : ("sem_chave" as const) } : await gatewayFor(db, keyKind, p.now);
  if (gw.gateway && allHave) try {
    const task = buildPackageTask(pp, MODELS.pacote);
    const res = await runTask(task, pp.system, { text: pp.text }, { gateway: gw.gateway, clock: systemClock, trace: langfuseTracer });
    await recordAiCall(db, { task: "plano", promptVersion: `${PLAN_PROMPT_VERSION}${p.promptVersionSuffix ?? promptSuffix(prompt, { tone: !!ctx.restaurant.aiTone, examples: examples.length > 0 })}`, restaurantId: p.restaurantId, result: res, keyKind: gw.keyKind });
    if (res.status === "ok") {
      choices = resolvePackage(pp, res.data);
      learned = resolveLearned(pp, res.data);
      aiOrder = res.data.ordem.map((a) => pp.slotByAlias.get(a)!.id);
    } else semIa = res.reason;
  } catch (err) {
    // Nunca deixa o plano preso em `gerando` (revisão técnica S3): cai no modo sem IA.
    log.error("falha ao gerar o plano", { area: "plano", err: safeErr(err) });
    choices = null;
    learned = null;
    aiOrder = null;
    semIa = "erro";
  }
  else semIa = allHave ? gw.reason : "sem_candidatas";

  const alias = new Map(slotAliases(ctx.slots).map((a) => [a.slot.id, a.alias]));
  if (!choices) {
    choices = fallbackChoices(ctx.slots, cands).map((c) => ({
      ...c,
      textoConvite: PLAN_FALLBACK_INVITE.replace("{horario}", `{horario:${c.slotId}}`),
      justificativa: justificationTemplate(alias.get(c.slotId) ?? "A", c.slotId, ins.facts),
    }));
  }
  if (!learned) learned = ins.offers.map((o) => ({ ofertaKey: o.key, verdict: o.verdict, texto: learnedTemplate(o.verdict, o.alias, o.slotId) }));

  const top = Object.fromEntries(cands.map((c) => [c.slotId, c.options[0]?.id ?? null]));
  const decision: WeeklyDecision = {
    mode: "plano",
    ...(semIa ? { semIa } : {}),
    caps: capBy,
    aiChoices: semIa ? null : choices.map((c) => ({ slotId: c.slotId, candidateId: c.candidateId })),
    topScore: top,
    verdicts: ins.offers.map((o) => ({ ofertaKey: o.key, verdict: o.verdict, slotId: o.slotId })),
  };
  const order = aiOrder ?? slotAliases(ctx.slots).map((a) => a.slot.id);
  // Revisor (flag; D148): marca "revisando" no MESMO update que publica a proposta (portal e MCP; sem janela),
  // e revisa depois da resposta. Contas E2E ficam fora.
  const review = !semIa && owner?.via !== "e2e" && (await getFlags(db)).revisor;
  await db
    .update(weeklyPlans)
    .set({
      status: "proposto",
      facts: ins.facts,
      candidates: cands.map((c) => ({ slotId: c.slotId, options: c.options.map(toPlanCandidate) })),
      choices,
      texts: { order, generatedBy: semIa ? "sem_ia" : "ia", version: 1 },
      learned,
      decision: review ? { ...decision, reviewer: { status: "revisando", reasons: [], at: p.now.toISOString() } } : decision,
    })
    .where(eq(weeklyPlans.id, started.planId));
  if (review) {
    const planId = started.planId;
    (p.schedule ?? inline)(() =>
      reviewPlan(db, { restaurantId: p.restaurantId, planId, now: p.now, gateway: p.reviewerGateway }).then(
        () => undefined,
        (err) => log.error("revisor falhou", { area: "plano", err: safeErr(err) }),
      ),
    );
  }
  return { ok: true, planId: started.planId, generatedBy: semIa ? "sem_ia" : "ia" };
}
