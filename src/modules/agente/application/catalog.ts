/**
 * Catálogo do agente para o MCP (S8 — D267–D269): as mesmas peças do copiloto — retrato das Configurações, fatos do
 * código, clientes sem contato e propostas com prévia do código — expostas a agentes externos. No MCP, quem confirma
 * é o próprio agente: `propor_mudanca` não grava; `aplicar_proposta` grava (via agente), sempre pelas mesmas
 * validações das Configurações. As 4 ferramentas antigas (plano da semana) continuam no `server.ts`.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { restaurants } from "@/src/db/schema";
import { slotLabel } from "@/src/modules/beneficios/domain/slot-text";
import { buildCopilotTools } from "@/src/modules/ia/tasks/copilot";
import { proposalPayloadSchema } from "../domain/proposals";
import { loadAgentContext } from "./context";
import { createProposals, decideProposal, loadSnapshot } from "./proposals";

export type McpFlags = { clientes: boolean; edicao: boolean };
type ToolDef = { name: string; description: string; inputSchema: Record<string, unknown>; gate?: keyof McpFlags };
const noArgs = { type: "object", properties: {}, additionalProperties: false };

export const CATALOG_TOOLS: ToolDef[] = [
  { name: "ver_configuracao", description: "Configuração atual do restaurante com ids: benefício de 1ª visita, recompensa da cartela, horários vazios (com oferta, teto e texto do convite) e cardápio (disponível, pode entrar em ofertas, em uso).", inputSchema: noArgs },
  { name: "ver_numeros", description: "Todos os números do restaurante calculados pelo código (convites, uso, check-ins, segmentos de clientes), com o rótulo de cada um.", inputSchema: noArgs },
  {
    name: "buscar_clientes",
    gate: "clientes",
    description: "Clientes do restaurante por nome curto e histórico (visitas, selos, última visita, grupos). Nunca contato. Filtros opcionais: segmento (sumiu, perto, convite_ativo, frequente) e parte do nome.",
    inputSchema: { type: "object", properties: { segmento: { type: ["string", "null"], enum: ["sumiu", "perto", "convite_ativo", "frequente", null] }, nome: { type: ["string", "null"], maxLength: 40 } }, additionalProperties: false },
  },
  {
    name: "propor_mudanca",
    gate: "edicao",
    description:
      'Propõe uma mudança (NÃO grava). O código confere as regras e devolve a prévia (antes → depois, custo) e um id; para valer, chame aplicar_proposta. Formatos: {"acao":"oferta","papel":"agora|recompensa|convite","slotId"?,"offer":{"kind","itemId","pct"?},"weeklyCap"?,"inviteText"?} · {"acao":"item","itemId","mudanca":"indisponivel|disponivel|fora_das_ofertas|nas_ofertas|preco","priceCents"?} · {"acao":"faixa","slotId","mudanca":"editar|desativar","days"?,"startMin"?,"endMin"?,"intensity"?,"extraTables"?}. Use os ids de ver_configuracao.',
    inputSchema: { type: "object", properties: { mudanca: { type: "object" } }, required: ["mudanca"], additionalProperties: false },
  },
  { name: "aplicar_proposta", gate: "edicao", description: "Aplica uma proposta feita por propor_mudanca (até 30 min; se algo mudou desde a prévia, ela expira). Passa a valer no salão. Registrado como mudança via agente.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } },
  { name: "descartar_proposta", gate: "edicao", description: "Descarta uma proposta feita por propor_mudanca.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } },
];

export function catalogTools(flags: McpFlags): Array<Omit<ToolDef, "gate">> {
  return CATALOG_TOOLS.filter((t) => !t.gate || flags[t.gate]).map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
}

type Out = { data: unknown; isError?: boolean };

/** Executa uma ferramenta do catálogo; `null` = não é do catálogo (ou está desligada pela flag). */
export async function callCatalogTool(db: Db, restaurantId: string, name: string, args: Record<string, unknown>, now: Date, flags: McpFlags, onApproved?: (restaurantId: string, inviteIds: string[]) => void): Promise<Out | null> {
  const def = CATALOG_TOOLS.find((t) => t.name === name);
  if (!def || (def.gate && !flags[def.gate])) return null;
  if (name === "ver_configuracao") {
    const snap = await loadSnapshot(db, restaurantId);
    if (!snap) return { data: { erro: "restaurante_nao_encontrado" }, isError: true };
    return {
      data: {
        beneficio_primeira_visita: snap.agora,
        recompensa_cartela: snap.recompensa,
        horarios_vazios: snap.slots.map((s) => ({ slotId: s.id, horario: slotLabel(s), intensidade: s.intensity, mesas_a_mais: s.extraTables, oferta: s.offer, teto_semanal: s.weeklyCap, texto_convite: s.inviteText })),
        cardapio: snap.menu.map((m) => ({ itemId: m.id, nome: m.name, categoria: m.category, preco_centavos: m.priceCents, disponivel: m.active, pode_entrar_em_ofertas: m.offerAllowed, em_uso_numa_oferta: m.inUse })),
        margem_pct: snap.marginPct,
      },
    };
  }
  if (name === "ver_numeros" || name === "buscar_clientes") {
    const [r] = await db.select({ name: restaurants.name }).from(restaurants).where(eq(restaurants.id, restaurantId));
    const input = r ? await loadAgentContext(db, { restaurantId, restaurantName: r.name, page: "mcp", now }) : null;
    if (!input) return { data: { erro: "restaurante_nao_encontrado" }, isError: true };
    // As MESMAS funções das ferramentas do copiloto (D267).
    const tool = buildCopilotTools(input).find((t) => t.name === name)!;
    const parsed = tool.input.safeParse(name === "buscar_clientes" ? { segmento: args.segmento ?? null, nome: args.nome ?? null } : {});
    if (!parsed.success) return { data: { erro: "argumentos_invalidos" }, isError: true };
    const { execute } = tool;
    const data = await execute(parsed.data);
    // No MCP, o apelido vai simples ("C8"): `{cliente:…}` é a referência interna dos textos do copiloto.
    return { data: JSON.parse(JSON.stringify(data).replace(/\{cliente:(C\d+)\}/g, "$1")) };
  }
  if (name === "propor_mudanca") {
    const parsed = proposalPayloadSchema.safeParse(args.mudanca);
    if (!parsed.success) return { data: { erro: "formato_da_mudanca", detalhe: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) }, isError: true };
    const [card] = await createProposals(db, { restaurantId, origin: "mcp", payloads: [parsed.data], now });
    if (!card || card.status === "recusada") return { data: { recusada: true, motivo: card?.status === "recusada" ? card.motivo : "Não deu para propor." }, isError: true };
    const { titulo, linhas, alcance, impacto, avisos } = card.preview;
    return { data: { id: card.id, previa: { titulo, linhas, alcance, impacto, avisos }, proximo_passo: "aplicar_proposta com este id, ou descartar_proposta" } };
  }
  const id = typeof args.id === "string" ? args.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { data: { erro: "id_invalido" }, isError: true };
  const r = await decideProposal(db, { restaurantId, proposalId: id, origin: "mcp", acao: name === "aplicar_proposta" ? "aplicar" : "descartar", now, onApproved });
  return r.ok ? { data: { status: r.status, ja_estava: r.already ?? false, ...(r.warnings?.length ? { avisos: r.warnings } : {}) } } : { data: { status: r.status, motivo: r.motivo }, isError: true };
}
