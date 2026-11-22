/**
 * Um turno do copiloto (S8 — D260–D266): carrega o retrato do restaurante e os fatos do código, roda a tarefa
 * `copiloto` (≤ 3 passos, rastro sem entrada nem saída — D262), grava as propostas (prévia do código) e devolve a
 * resposta já renderizada. Sem IA (sem chave, teto, falha): resposta fixa + atalhos para a aba certa (modo sem IA).
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { owners, restaurants } from "@/src/db/schema";
import type { AiGateway, ChatTurn } from "@/src/modules/ia/gateway";
import { dailyCapOff, gatewayFor, keyKindFor } from "@/src/modules/ia/gateway-factory";
import { COPILOT_PUBLIC_DAILY_CAP_USD, copilotSpentToday, recordAiCall } from "@/src/modules/ia/ai-calls";
import { MODELS } from "@/src/modules/ia/models";
import { runTask } from "@/src/modules/ia/run-task";
import { langfuseTracer } from "@/src/modules/ia/tracing";
import { systemClock } from "@/src/shared/clock";
import { parseAiFeatures } from "@/src/modules/config/domain/ai-profile";
import { buildCopilotPrompt, buildCopilotTask, buildOnboardingPrompt, buildCopilotTools, COPILOT_PROMPT_VERSION, normalizeHistory, renderAnswer, toPayload } from "@/src/modules/ia/tasks/copilot";
import type { ProposalPayload } from "../domain/proposals";
import { createProposals, type ProposalCard } from "./proposals";
import { loadAgentContext } from "./context";
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
  if (!r) return noAi("inativo");
  const onboarding = r.status !== "ativo";
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
  // D254: `IA_SEM_TETO_DIARIO` (env) também suspende o teto próprio do copiloto.
  if (keyKind === "publica" && !dailyCapOff() && (await copilotSpentToday(db, "publica", p.now)) >= COPILOT_PUBLIC_DAILY_CAP_USD) return noAi("teto_diario");

  // Ativação (D265): só dúvidas, com o guia do produto (sem dados nem propostas).
  if (onboarding) {
    const cp = buildOnboardingPrompt(p.page);
    const res = await runTask({ ...buildCopilotTask(cp, MODELS.copiloto, [], p.sessionId) }, cp.system, { messages: turns }, { gateway, clock: systemClock, trace: langfuseTracer });
    await recordAiCall(db, { task: "copiloto", promptVersion: `${COPILOT_PROMPT_VERSION}-ativacao`, restaurantId: p.restaurantId, result: res, keyKind });
    if (res.status !== "ok") return { ...noAi("falha", "Não consegui responder agora. Siga os passos da ativação; cada campo explica o que pede."), atalhos: [] };
    return { resposta: renderAnswer(res.data.resposta, cp.ctx), propostas: [], sugestoes: res.data.sugestoes.map((x) => renderAnswer(x, cp.ctx)), generatedBy: "ia", atalhos: [] };
  }

  const input = await loadAgentContext(db, { restaurantId: p.restaurantId, restaurantName: r.name, tone: r.aiTone, page: p.page, now: p.now });
  if (!input) return noAi("inativo");
  const cp = buildCopilotPrompt(input);
  const task = buildCopilotTask(cp, MODELS.copiloto, buildCopilotTools(input), p.sessionId);
  const res = await runTask(task, cp.system, { messages: turns }, { gateway, clock: systemClock, trace: langfuseTracer });
  const aiCallId = await recordAiCall(db, { task: "copiloto", promptVersion: COPILOT_PROMPT_VERSION, restaurantId: p.restaurantId, result: res, keyKind });
  if (res.status !== "ok") return noAi("falha");

  const mapped = res.data.propostas.map((x) => toPayload(cp, x));
  const payloads = mapped.filter((x): x is ProposalPayload => !("erro" in x));
  const created = payloads.length ? await createProposals(db, { restaurantId: p.restaurantId, origin: "copiloto", payloads, aiCallId, now: p.now }) : [];
  // Revisão S8 (produto 5): proposta incompleta não some em silêncio; vira cartão com o motivo.
  const incomplete: ProposalCard[] = mapped.filter((x): x is { erro: string } => "erro" in x).map(() => ({ id: null, status: "recusada", motivo: "Faltou informação para montar a mudança (o prato, o horário ou o tipo da oferta). Diga o que trocar e pelo quê.", payload: { acao: "tom", tone: "" } }));
  const propostas = [...created, ...incomplete];
  let resposta = renderAnswer(res.data.resposta, cp.ctx);
  // O texto da IA não pode prometer um cartão que não há (revisão S8, produto 5).
  if (!propostas.some((c) => c.status === "pendente") && /proposta abaixo|preparei (a|uma) proposta/i.test(resposta)) {
    resposta = propostas.length ? "Não preparei a mudança: veja o motivo abaixo." : "Não consegui montar essa mudança. Diga o prato e o horário, ou faça pelo formulário.";
  }
  return {
    resposta,
    propostas,
    sugestoes: res.data.sugestoes.map((s) => renderAnswer(s, cp.ctx)),
    generatedBy: "ia",
    // Atalhos só no modo sem IA (revisão S8: depois de uma resposta da IA, eram ruído).
    atalhos: [],
  };
}
