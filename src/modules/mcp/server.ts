/**
 * Servidor MCP mínimo (flag `mcp`; planejamento S3 §6.4, revisão T-I9): JSON-RPC 2.0 escrito à mão, sem estado,
 * sem SDK. Métodos: `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`.
 * O restaurante vem SEMPRE do token (nenhuma ferramenta recebe `restaurantId`); respostas só com agregados.
 * A aprovação fica registrada como "via agente" (D219).
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/src/db/client";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { restaurants } from "@/src/db/schema";
import { getPlanInsights } from "@/src/modules/planos/application/insights";
import { getPlanView } from "@/src/modules/planos/application/plan-view";
import { generateWeeklyPlan } from "@/src/modules/planos/application/generate-plan";
import { approvePlan, finalFromStored, latestPlan } from "@/src/modules/planos/application/approve-plan";
import { slotLabel } from "@/src/modules/beneficios/domain/slot-text";
import { getFlags } from "@/src/modules/config/application/app-config";
import { callCatalogTool, catalogTools } from "@/src/modules/agente/application/catalog";

export const MCP_PROTOCOL_VERSION = "2025-06-18";

type Json = Record<string, unknown>;
export type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Json };
export type RpcResponse = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const rpcSchema = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string().max(100), z.number(), z.null()]).optional(), method: z.string().max(100), params: z.record(z.string(), z.unknown()).optional() });

const TOOLS = [
  { name: "ler_insights", description: "Lê os números do restaurante dos últimos 30 dias: ofertas de convite com o veredito do código (manter, trocar, cedo demais), uso dos convites, segmentos de clientes e turnos com poucos check-ins. Só agregados.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "ver_plano", description: "Mostra o plano da semana mais recente: estado, oferta, teto e convite de cada horário vazio, justificativa e 'o que aprendemos'.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "gerar_plano", description: "Gera um novo plano da semana (a IA escolhe entre ofertas que o código validou). Fica como proposta: precisa ser aprovado.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "aprovar_plano",
    description: "Aprova o plano proposto como está (ofertas, tetos e convites propostos). Passa a valer no salão e entrega a reativação (convite no app do cliente e e-mail para quem aceitou). Registrado como 'aprovado via agente'.",
    inputSchema: { type: "object", properties: { planId: { type: "string", description: "id do plano (de ver_plano)" } }, required: ["planId"], additionalProperties: false },
  },
] as const;

const text = (data: unknown, isError = false) => ({ content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError });

/** Injeções (testes): como agendar o revisor e gateways falsos de IA. */
export type RpcDeps = { schedule?: (fn: () => Promise<void>) => void; gateway?: AiGateway | null; reviewerGateway?: AiGateway | null; onApproved?: (restaurantId: string, inviteIds: string[]) => void };

async function callTool(db: Db, restaurantId: string, name: string, args: Json, now: Date, deps: RpcDeps) {
  if (name === "ler_insights") {
    const ins = await getPlanInsights(db, restaurantId, now);
    if (!ins) return text({ erro: "restaurante_nao_encontrado" }, true);
    const label = new Map(ins.ctx.slots.map((s) => [s.id, slotLabel(s)]));
    return text({
      hoje: ins.today,
      checkins_30d: ins.facts.checkins_30d,
      ofertas: ins.offers.map((o) => ({ horario: label.get(o.slotId), oferta: o.title, veredito: o.verdict, convites_7d: o.issued7d, usados_7d: o.used7d, teto_recalibrado: o.recalibratedCap })),
      segmentos: Object.fromEntries(Object.entries(ins.segments).map(([k, v]) => [k, { clientes: v.count, com_opt_in: v.optIn }])),
      turnos_com_poucos_checkins_nao_marcados: ins.heatmap.lowUndeclared.length,
      aviso: "Veredito por indicadores antecipados (não causal). O efeito causal está no painel, contra o grupo de controle.",
    });
  }
  if (name === "ver_plano") {
    const v = await getPlanView(db, restaurantId, now);
    if (!v?.plan) return text({ plano: null, dica: "Use gerar_plano." });
    return text({
      plano: { id: v.plan.id, estado: v.generating ? "gerando" : v.plan.status, semana: v.plan.weekKey, origem: v.plan.generatedBy, vencido: v.plan.stale, revisor: v.plan.review?.status ?? null },
      horarios: v.slots.map((s) => ({ horario: `${s.label} (${s.phrase})`, oferta: s.options.find((o) => o.id === s.chosenId)?.title ?? null, teto_semanal: s.weeklyCap, convite: s.inviteRendered, justificativa: s.justificativa })),
      o_que_aprendemos: v.learned.map((l) => ({ oferta: l.title, veredito: l.verdict, texto: l.texto })),
    });
  }
  if (name === "gerar_plano") {
    const [r] = await db.select({ ownerId: restaurants.ownerId }).from(restaurants).where(eq(restaurants.id, restaurantId));
    if (!r) return text({ erro: "restaurante_nao_encontrado" }, true);
    const g = await generateWeeklyPlan(db, { restaurantId, ownerId: r.ownerId, now, schedule: deps.schedule, gateway: deps.gateway, reviewerGateway: deps.reviewerGateway });
    return g.ok ? text({ planId: g.planId, origem: g.generatedBy, proximo_passo: "ver_plano e, se estiver bom, aprovar_plano" }) : text({ erro: g.erro }, true);
  }
  if (name === "aprovar_plano") {
    const planId = typeof args.planId === "string" ? args.planId : "";
    const plan = await latestPlan(db, restaurantId);
    if (!plan || plan.id !== planId) return text({ erro: "plano_nao_encontrado_ou_nao_e_o_mais_recente" }, true);
    const { slots } = finalFromStored(plan);
    if (!slots.length) return text({ erro: "plano_sem_escolhas" }, true);
    const r = await approvePlan(db, { restaurantId, planId, final: { slots }, via: "agente", now });
    if (r.ok) {
      if (r.inviteIds?.length) deps.onApproved?.(restaurantId, r.inviteIds);
      return text({ aprovado: true, ja_estava: r.already, reativacao: { entregues: r.sent.real } });
    }
    return text({ erro: r.erro, ...(r.erro === "revisor" ? { dica: "O revisor ainda está conferindo (até 20 s) ou pediu ajustes: veja ver_plano e tente de novo; ajustes de texto só pelo Portal." } : {}) }, true);
  }
  return null;
}

/** Trata 1 mensagem JSON-RPC; notificação → null (HTTP 202). */
export async function handleRpc(db: Db, restaurantId: string, raw: unknown, now: Date, deps: RpcDeps = {}): Promise<RpcResponse | null> {
  const parsed = rpcSchema.safeParse(raw);
  if (!parsed.success) return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } };
  const m = parsed.data;
  const id = m.id ?? null;
  if (m.id === undefined) return null;
  if (m.method === "initialize") return { jsonrpc: "2.0", id, result: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "comer-fora-no-salao", version: "1.0.0" }, instructions: "Ferramentas de UM restaurante (o do token): plano da semana, configuração, números e, se ligado, clientes (sem contato) e mudanças por proposta (propor_mudanca → aplicar_proposta). Números e dinheiro são do código; aprovar e aplicar valem no salão." } };
  if (m.method === "ping") return { jsonrpc: "2.0", id, result: {} };
  // S8 (D267): o catálogo do agente (mesmas peças do copiloto) entra depois das 4 ferramentas do plano.
  const flags = await getFlags(db);
  const cat = { clientes: flags.mcp_clientes, edicao: flags.mcp_edicao };
  if (m.method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: [...TOOLS, ...catalogTools(cat)] } };
  if (m.method === "tools/call") {
    const name = typeof m.params?.name === "string" ? m.params.name : "";
    const args = (m.params?.arguments && typeof m.params.arguments === "object" ? m.params.arguments : {}) as Json;
    const c = await callCatalogTool(db, restaurantId, name, args, now, cat);
    const r = c ? text(c.data, c.isError) : await callTool(db, restaurantId, name, args, now, deps);
    return r ? { jsonrpc: "2.0", id, result: r } : { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${name.slice(0, 40)}` } };
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
}
