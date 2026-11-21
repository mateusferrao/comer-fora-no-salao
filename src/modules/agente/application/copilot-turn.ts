/**
 * Um turno do copiloto (S8 — D260–D266): carrega o retrato do restaurante e os fatos do código, roda a tarefa
 * `copiloto` (≤ 3 passos, rastro sem entrada nem saída — D262), grava as propostas (prévia do código) e devolve a
 * resposta já renderizada. Sem IA (sem chave, teto, falha): resposta fixa + atalhos para a aba certa (modo sem IA).
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { owners, restaurants } from "@/src/db/schema";
import { slotAliases } from "@/src/modules/beneficios/domain/slot-text";
import { getPlanInsights } from "@/src/modules/planos/application/insights";
import { shortName } from "@/src/shared/name";
import type { AiGateway, ChatTurn } from "@/src/modules/ia/gateway";
import { gatewayFor, keyKindFor } from "@/src/modules/ia/gateway-factory";
import { COPILOT_PUBLIC_DAILY_CAP_USD, recordAiCall, spentToday } from "@/src/modules/ia/ai-calls";
import { MODELS } from "@/src/modules/ia/models";
import { runTask } from "@/src/modules/ia/run-task";
import { langfuseTracer } from "@/src/modules/ia/tracing";
import { systemClock } from "@/src/shared/clock";
import { parseAiFeatures } from "@/src/modules/config/domain/ai-profile";
import { buildCopilotPrompt, buildCopilotTask, buildCopilotTools, COPILOT_PROMPT_VERSION, normalizeHistory, renderAnswer, toPayload, type CopilotCustomer } from "@/src/modules/ia/tasks/copilot";
import type { ProposalPayload } from "../domain/proposals";
import { createProposals, loadSnapshot, type ProposalCard } from "./proposals";
import { shortcutsFor, type Shortcut } from "../domain/shortcuts";

export type TurnResult = {
  resposta: string;
  propostas: ProposalCard[];
  sugestoes: string[];
  generatedBy: "ia" | "sem_ia";
  motivoSemIa?: "sem_chave" | "teto_diario" | "falha" | "inativo";
  atalhos: Shortcut[];
};

const NO_AI = "Não consegui responder agora. Você pode fazer a mesma mudança direto nas Configurações:";

export async function runCopilotTurn(
  db: Db,
  p: { restaurantId: string; ownerId: string; turns: readonly ChatTurn[]; page: string; now: Date; gateway?: AiGateway | null; sessionId?: string },
): Promise<TurnResult> {
  const turns = normalizeHistory(p.turns);
  const last = turns.at(-1)?.text ?? "";
  const atalhos = shortcutsFor(last);
  const noAi = (motivo: NonNullable<TurnResult["motivoSemIa"]>, resposta = NO_AI): TurnResult => ({ resposta, propostas: [], sugestoes: [], generatedBy: "sem_ia", motivoSemIa: motivo, atalhos });

  const [r] = await db.select({ status: restaurants.status, name: restaurants.name, aiTone: restaurants.aiTone, aiFeatures: restaurants.aiFeatures }).from(restaurants).where(eq(restaurants.id, p.restaurantId));
  if (!r || r.status !== "ativo") return noAi("inativo", "O assistente fica disponível depois de ativar o Comer Fora no salão.");
  // D197: o dono pode desligar o agente da IA do restaurante; o copiloto respeita (é um agente).
  if (!parseAiFeatures(r.aiFeatures).agente) return noAi("falha", "O assistente está desligado na aba “IA do restaurante”. Você pode fazer a mudança direto nas Configurações:");

  const [owner] = await db.select({ emailHmac: owners.emailHmac, via: owners.via }).from(owners).where(eq(owners.id, p.ownerId));
  const keyKind = keyKindFor({ emailHmac: owner?.emailHmac ?? null, via: owner?.via ?? null });
  let gateway = p.gateway;
  if (gateway === undefined) {
    const choice = await gatewayFor(db, keyKind, p.now);
    if (!choice.gateway) return noAi(choice.reason === "teto_diario" ? "teto_diario" : "sem_chave");
    gateway = choice.gateway;
  }
  if (!gateway) return noAi("sem_chave");
  if (keyKind === "publica" && (await spentToday(db, "publica", p.now, "copiloto")) >= COPILOT_PUBLIC_DAILY_CAP_USD) return noAi("teto_diario");

  const [snap, ins] = await Promise.all([loadSnapshot(db, p.restaurantId), getPlanInsights(db, p.restaurantId, p.now)]);
  if (!snap || !ins) return noAi("inativo");
  // Apelidos estáveis: ordem do id (C1…); nome curto (primeiro nome + inicial), nunca contato (D262).
  const customers: CopilotCustomer[] = [...ins.customers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c, i) => ({ alias: `C${i + 1}`, name: shortName(c.displayName), visits: c.visits, stamps: c.stamps, lastDay: c.lastDay, segments: c.segments }));
  const aliases = slotAliases(ins.ctx.slots).map(({ alias, slot }) => ({ alias, slotId: slot.id }));
  const input = {
    restaurantName: r.name,
    snap,
    facts: ins.facts,
    slotAliases: aliases,
    customers,
    plan: ins.offers.length ? { status: "veja ver_plano", slots: ins.offers.map((o) => ({ alias: o.alias, gain: o.gain, weeklyCap: o.recalibratedCap })) } : null,
    page: p.page,
    tone: r.aiTone,
  };
  const cp = buildCopilotPrompt(input);
  const task = buildCopilotTask(cp, MODELS.copiloto, buildCopilotTools(input), p.sessionId);
  const res = await runTask(task, cp.system, { messages: turns }, { gateway, clock: systemClock, trace: langfuseTracer });
  const aiCallId = await recordAiCall(db, { task: "copiloto", promptVersion: COPILOT_PROMPT_VERSION, restaurantId: p.restaurantId, result: res, keyKind });
  if (res.status !== "ok") return noAi("falha");

  const payloads = res.data.propostas.map((x) => toPayload(cp, x)).filter((x): x is ProposalPayload => !("erro" in x));
  const propostas = payloads.length ? await createProposals(db, { restaurantId: p.restaurantId, origin: "copiloto", payloads, aiCallId, now: p.now }) : [];
  return {
    resposta: renderAnswer(res.data.resposta, cp.ctx),
    propostas,
    sugestoes: res.data.sugestoes.map((s) => renderAnswer(s, cp.ctx)),
    generatedBy: "ia",
    atalhos: propostas.length ? [] : atalhos,
  };
}
