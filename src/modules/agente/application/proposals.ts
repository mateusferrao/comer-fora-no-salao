/**
 * Propostas (S8 — D261, D269): grava a prévia do código e aplica SÓ pela proposta guardada no banco, com reserva
 * atômica (dois cliques ou botão + MCP → um efeito — revisão técnica B4) e conferência do "antes" (`base_hash`): se o
 * alvo mudou desde a prévia, a proposta expira em vez de aplicar algo que o dono não viu (B5). A gravação usa as
 * MESMAS funções das Configurações, que revalidam tudo.
 */
import { createHash } from "node:crypto";
import { and, eq, gt, lte, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { agentProposals } from "@/src/db/schema";
import { describeOffer, offerFromInput } from "@/src/modules/beneficios/domain/offers";
import { slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import { guardText } from "@/src/modules/ia/guardrails";
import { textIssues } from "@/src/modules/ia/guardrails/messages";
import { addMenuItem, deactivateSlot, getSettingsView, setItemOfferAllowed, setMenuItemActive, updateMenuItem, updateNotifySettings, updateOffer, updateRestaurantFinance, updateSlot, updateTone } from "@/src/modules/config/application/update-settings";
import { parseNotifySettings } from "@/src/modules/config/domain/notify-settings";
import { validateTone } from "@/src/modules/config/domain/tone";
import { FORBIDDEN } from "@/src/modules/ia/guardrails";
import { approvePlan, finalFromStored, latestPlan, type ApproveVia } from "@/src/modules/planos/application/approve-plan";
import { getPlanView } from "@/src/modules/planos/application/plan-view";
import { restaurants } from "@/src/db/schema";
import type { RestaurantContext } from "@/src/modules/salao/application/context";
import { previewProposal, proposalPayloadSchema, type PreviewOk, type ProposalPayload, type Snapshot } from "../domain/proposals";

export const PROPOSAL_TTL_MS = 30 * 60_000;
export type Origin = "copiloto" | "mcp";

export type ProposalCard = { id: string; status: "pendente"; preview: PreviewOk; payload: ProposalPayload } | { id: null; status: "recusada"; motivo: string; payload: ProposalPayload };

/** JSON com chaves ordenadas: o mesmo "antes" dá sempre o mesmo hash. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}
export const baseHash = (antes: unknown) => createHash("sha256").update(stableJson(antes)).digest("hex");

export async function loadSnapshot(db: Db, restaurantId: string, opts: { plan?: boolean; now?: Date; ctx?: RestaurantContext } = {}): Promise<Snapshot | null> {
  const v = await getSettingsView(db, restaurantId, opts.ctx);
  if (!v) return null;
  const [r] = await db.select({ notify: restaurants.notifySettings }).from(restaurants).where(eq(restaurants.id, restaurantId));
  // Plano proposto (onda 2): só quando a ação é aprovar (a prévia da reativação custa consultas).
  let plan: Snapshot["plan"] = null;
  if (opts.plan) {
    const lp = await latestPlan(db, restaurantId);
    if (lp && lp.status === "proposto") {
      const final = finalFromStored(lp);
      const view = await getPlanView(db, restaurantId, opts.now ?? new Date(), lp.id);
      plan = { id: lp.id, slots: final.slots, audience: view?.reactivation.real ?? 0 };
    }
  }
  return {
    tone: v.restaurant.aiTone,
    ticketCents: v.restaurant.ticketCents,
    resumo: parseNotifySettings(r?.notify).resumo,
    plan,
    marginPct: v.restaurant.marginPct,
    opening: v.restaurant.opening,
    agora: v.agora,
    recompensa: v.recompensa,
    slots: v.slots.map((s) => ({ id: s.id, days: s.days, startMin: s.startMin, endMin: s.endMin, intensity: s.intensity, extraTables: s.extraTables, offer: s.offer, weeklyCap: s.weeklyCap, inviteText: s.inviteText })),
    menu: v.menu.map((m) => ({ id: m.id, name: m.name, category: m.category, priceCents: m.priceCents, active: m.active, inUse: m.inUse, offerAllowed: m.offerAllowed })),
  };
}

/** Texto de convite escrito pela IA ou pelo agente: regras do guard em modo IA (D226), com a mensagem que diz o porquê. */
function inviteTextProblem(snap: Snapshot, p: Extract<ProposalPayload, { acao: "oferta" }>, text: string): string | null {
  const slot = snap.slots.find((s) => s.id === p.slotId)!;
  const menu = snap.menu.map((m) => ({ id: m.id, name: m.name, category: m.category, priceCents: m.priceCents }));
  const ctx = { items: Object.fromEntries(menu.map((m) => [m.id, m.name])), slots: { [slot.id]: slotPhrase(slot) }, oferta: describeOffer(offerFromInput(p.offer), menu, "convite").gain };
  const g = guardText(text, ctx, { allowed: ["prato", "horario", "oferta"], maxLen: 160, field: "textoConvite", mode: "ia", requireSlot: slot.id });
  if (g.ok) return null;
  return textIssues(g, { maxLen: 160 }).errors[0] ?? "O texto do convite não passou nas regras.";
}

/**
 * Prévia + gravação (status `pendente`). Recusas do código voltam com o motivo e não são gravadas.
 * `snap`: retrato já carregado no turno (revisão S8, item 23). Seguro: o "antes" da prévia vira o `base_hash`, e a
 * aplicação confere com o estado do momento — se algo mudou durante o turno, a proposta expira em vez de aplicar.
 * Aprovar o plano precisa do plano no retrato: aí recarrega.
 */
export async function createProposals(db: Db, p: { restaurantId: string; origin: Origin; payloads: readonly ProposalPayload[]; aiCallId?: string | null; now: Date; snap?: Snapshot }): Promise<ProposalCard[]> {
  const needsPlan = p.payloads.some((x) => x.acao === "plano");
  const snap = p.snap && !needsPlan ? p.snap : await loadSnapshot(db, p.restaurantId, { plan: needsPlan, now: p.now });
  if (!snap) return p.payloads.map((payload) => ({ id: null, status: "recusada" as const, motivo: "Restaurante não encontrado.", payload }));
  const out: ProposalCard[] = [];
  for (const payload of p.payloads) {
    // Revisão S8 (técnica A1): os limites valem para as duas portas (o copiloto passava sem o Zod do MCP).
    if (!proposalPayloadSchema.safeParse(payload).success) {
      out.push({ id: null, status: "recusada", motivo: "Algum valor está fora dos limites (ex.: margem até 95%, resumo entre 06:00 e 22:00 em hora cheia ou meia hora, teto até 999).", payload });
      continue;
    }
    const pv = previewProposal(snap, payload);
    if (!pv.ok) {
      out.push({ id: null, status: "recusada", motivo: pv.motivo, payload });
      continue;
    }
    if (payload.acao === "tom") {
      const v = validateTone(payload.tone, FORBIDDEN);
      if (!v.ok) {
        out.push({ id: null, status: "recusada", motivo: TONE_ERR[v.erro] ?? "O tom não passou nas regras.", payload });
        continue;
      }
    }
    if (payload.acao === "oferta" && payload.papel === "convite" && payload.inviteText?.trim()) {
      const bad = inviteTextProblem(snap, payload, payload.inviteText);
      if (bad) {
        out.push({ id: null, status: "recusada", motivo: bad, payload });
        continue;
      }
    }
    const [row] = await db
      .insert(agentProposals)
      .values({ restaurantId: p.restaurantId, origin: p.origin, action: payload.acao, payload, preview: pv, baseHash: baseHash(pv.antes), aiCallId: p.aiCallId ?? null, createdAt: p.now })
      .returning({ id: agentProposals.id });
    out.push({ id: row!.id, status: "pendente", preview: pv, payload });
  }
  return out;
}

const TONE_ERR: Record<string, string> = {
  longo: "O tom passa de 200 caracteres.",
  caracteres: "Tire chaves, sinais < > e quebras de linha do tom.",
  url: "Tire links do tom.",
  proibida: "O tom usa uma palavra que as regras dos textos não permitem (promessa de preço ou da marca).",
  dados: "Tire e-mail ou números longos do tom.",
};

export type DecideResult =
  | { ok: true; status: "aplicada" | "descartada"; already?: boolean; aba?: PreviewOk["aba"]; warnings?: string[] }
  | { ok: false; status: "expirada" | "falhou" | "nao_encontrada" | "descartada" | "em_andamento"; motivo: string };

/** Reserva presa em `aplicando` (processo caiu no meio) vira `falhou` depois deste tempo (revisão S8, técnica A2). */
export const APPLYING_STALE_MS = 2 * 60_000;

/**
 * Faxina do agendador (revisão S8, item 25): pendente que ninguém decidiu em 30 min vira `expirada` (motivo
 * `sem_decisao`) e reserva presa vira `falhou` — antes isso só acontecia quando alguém tentava aplicar, e a métrica
 * "vencidas" subcontava. Nada é apagado: as linhas não têm dado pessoal e apagar só as não aplicadas inflaria o
 * "% aplicadas" com o tempo.
 */
export async function sweepProposals(db: Db, now: Date): Promise<{ expired: number; failed: number }> {
  const expired = await db
    .update(agentProposals)
    .set({ status: "expirada", error: "sem_decisao", decidedAt: now })
    .where(and(eq(agentProposals.status, "pendente"), lte(agentProposals.createdAt, new Date(now.getTime() - PROPOSAL_TTL_MS))))
    .returning({ id: agentProposals.id });
  const failed = await db
    .update(agentProposals)
    .set({ status: "falhou", error: "reserva_presa", decidedAt: now })
    .where(and(eq(agentProposals.status, "aplicando"), lte(agentProposals.createdAt, new Date(now.getTime() - PROPOSAL_TTL_MS - APPLYING_STALE_MS))))
    .returning({ id: agentProposals.id });
  return { expired: expired.length, failed: failed.length };
}

const APPLY_ERR: Record<string, string> = {
  em_uso: "O prato está numa oferta em vigor. Troque a oferta antes.",
  ultima_faixa: "É o único horário vazio: o convite precisa de pelo menos um.",
  sem_opcao: "Sem esse prato, o horário ficaria sem nenhuma oferta possível.",
  nao_encontrado: "Não encontrei o que essa proposta muda.",
  oferta: "A oferta não passou nas regras.",
  texto: "O texto do convite não passou nas regras.",
  faixa: "O horário não passou nas regras.",
  funcionamento: "Algum horário vazio ficaria fora do funcionamento.",
  nao_proposto: "O plano não está mais esperando aprovação.",
  revisor: "O revisor ainda está conferindo o plano ou pediu ajustes. Veja a aba Plano da semana.",
  inativo: "O restaurante não está ativo.",
};

type RunCtx = { via: ApproveVia; onApproved?: (restaurantId: string, inviteIds: string[]) => void };

async function run(db: Db, restaurantId: string, payload: ProposalPayload, snap: Snapshot, pv: PreviewOk, now: Date, rc: RunCtx): Promise<{ ok: true; warnings?: string[] } | { ok: false; erro: string }> {
  switch (payload.acao) {
    case "plano": {
      const lp = await latestPlan(db, restaurantId);
      if (!lp || lp.id !== payload.planId || lp.status !== "proposto") return { ok: false, erro: "nao_proposto" };
      const final = finalFromStored(lp);
      const slots = final.slots.map((s) => {
        if (s.slotId !== payload.slotId) return s;
        const offer = payload.offer ?? s.offer;
        const cited = [...s.inviteText.matchAll(/\{prato:([^}]+)\}/g)].some((m) => m[1] !== offer.itemId);
        return { ...s, offer, weeklyCap: payload.weeklyCap ?? s.weeklyCap, inviteText: cited ? `Volte {horario:${s.slotId}} e aproveite {oferta}.` : s.inviteText };
      });
      const r = await approvePlan(db, { restaurantId, planId: lp.id, final: { slots }, via: rc.via, now });
      if (!r.ok) return { ok: false, erro: r.erro };
      if (r.inviteIds?.length) rc.onApproved?.(restaurantId, r.inviteIds);
      return { ok: true };
    }
    case "tom": {
      const r = await updateTone(db, { restaurantId, tone: payload.tone, now });
      return r.ok ? { ok: true } : { ok: false, erro: "texto" };
    }
    case "item_novo": {
      const r = await addMenuItem(db, { restaurantId, name: payload.name, category: payload.category, priceCents: payload.priceCents, now });
      return r.ok ? { ok: true } : { ok: false, erro: "texto" };
    }
    case "restaurante":
      return updateRestaurantFinance(db, { restaurantId, ticketCents: payload.ticketCents, marginPct: payload.marginPct, now });
    case "avisos": {
      const [r] = await db.select({ notify: restaurants.notifySettings }).from(restaurants).where(eq(restaurants.id, restaurantId));
      const cur = parseNotifySettings(r?.notify);
      await updateNotifySettings(db, { restaurantId, input: { ...cur, resumo: { on: payload.resumoOn ?? cur.resumo.on, weekday: payload.weekday ?? cur.resumo.weekday, minute: payload.minute ?? cur.resumo.minute } }, now });
      return { ok: true };
    }
    case "oferta":
      return updateOffer(db, { restaurantId, role: payload.papel, slotId: payload.slotId, offer: payload.offer, ...(payload.papel === "convite" ? { weeklyCap: Math.max(1, Math.min(999, Math.round(payload.weeklyCap ?? snap.slots.find((s) => s.id === payload.slotId)?.weeklyCap ?? 4))), inviteText: pv.inviteText } : {}), now });
    case "item": {
      const it = snap.menu.find((m) => m.id === payload.itemId)!;
      if (payload.mudanca === "indisponivel" || payload.mudanca === "disponivel") return setMenuItemActive(db, { restaurantId, itemId: it.id, active: payload.mudanca === "disponivel", now });
      if (payload.mudanca === "fora_das_ofertas" || payload.mudanca === "nas_ofertas") return setItemOfferAllowed(db, { restaurantId, itemId: it.id, allowed: payload.mudanca === "nas_ofertas", now });
      return updateMenuItem(db, { restaurantId, itemId: it.id, name: it.name, category: it.category, priceCents: Math.round(payload.priceCents!), now });
    }
    case "faixa": {
      if (payload.mudanca === "desativar") return deactivateSlot(db, { restaurantId, slotId: payload.slotId, now });
      const s = snap.slots.find((x) => x.id === payload.slotId)!;
      return updateSlot(db, { restaurantId, slotId: s.id, days: payload.days ?? s.days, startMin: payload.startMin ?? s.startMin, endMin: payload.endMin ?? s.endMin, intensity: payload.intensity ?? s.intensity, extraTables: payload.extraTables ?? s.extraTables, now });
    }
  }
}

/**
 * Aplicar ou descartar. A proposta precisa ser da loja atual e da mesma porta (no MCP só as do MCP — D269), estar
 * pendente e ter menos de 30 min; o "antes" é recalculado e comparado.
 */
export async function decideProposal(db: Db, p: { restaurantId: string; proposalId: string; origin: Origin; acao: "aplicar" | "descartar"; now: Date; onApproved?: RunCtx["onApproved"] }): Promise<DecideResult> {
  const where = and(eq(agentProposals.id, p.proposalId), eq(agentProposals.restaurantId, p.restaurantId), eq(agentProposals.origin, p.origin));
  if (p.acao === "descartar") {
    const upd = await db.update(agentProposals).set({ status: "descartada", decidedAt: p.now }).where(and(where, eq(agentProposals.status, "pendente"))).returning({ id: agentProposals.id });
    if (upd.length) return { ok: true, status: "descartada" };
    return explain(db, where, p.now);
  }
  const fresh = new Date(p.now.getTime() - PROPOSAL_TTL_MS);
  const [row] = await db
    .update(agentProposals)
    .set({ status: "aplicando" })
    .where(and(where, eq(agentProposals.status, "pendente"), gt(agentProposals.createdAt, fresh)))
    .returning();
  if (!row) {
    // Vencida: marca como expirada (se ainda estiver pendente) e explica.
    await db.update(agentProposals).set({ status: "expirada", decidedAt: p.now }).where(and(where, eq(agentProposals.status, "pendente"), sql`${agentProposals.createdAt} <= ${fresh}`));
    return explain(db, where, p.now);
  }
  const finish = (status: "aplicada" | "expirada" | "falhou", error?: string) => db.update(agentProposals).set({ status, error: error ?? null, decidedAt: p.now }).where(eq(agentProposals.id, row.id));
  const payload = row.payload as ProposalPayload;
  const snap = await loadSnapshot(db, p.restaurantId, { plan: payload.acao === "plano", now: p.now });
  const pv = snap ? previewProposal(snap, payload) : null;
  if (!snap || !pv?.ok || baseHash(pv.antes) !== row.baseHash) {
    await finish("expirada", "antes_mudou");
    return { ok: false, status: "expirada", motivo: "Algo mudou desde a proposta. Peça de novo para ver a versão atual." };
  }
  let done: "aplicada" | "falhou" = "falhou";
  let error: string | undefined = "erro_interno";
  try {
    const res = await run(db, p.restaurantId, payload, snap, pv, p.now, { via: p.origin === "mcp" ? "agente" : "copiloto", onApproved: p.onApproved });
    if (!res.ok) {
      error = res.erro;
      return { ok: false, status: "falhou", motivo: APPLY_ERR[res.erro] ?? "Não deu para aplicar." };
    }
    done = "aplicada";
    error = undefined;
    return { ok: true, status: "aplicada", aba: pv.aba, ...(res.warnings?.length ? { warnings: res.warnings } : {}) };
  } finally {
    // Sempre fecha a reserva (revisão S8, técnica A2): nada fica em `aplicando` por exceção.
    await finish(done, error).catch(() => undefined);
  }
}

async function explain(db: Db, where: ReturnType<typeof and>, now: Date = new Date()): Promise<DecideResult> {
  const [r] = await db.select({ id: agentProposals.id, status: agentProposals.status, createdAt: agentProposals.createdAt }).from(agentProposals).where(where);
  if (!r) return { ok: false, status: "nao_encontrada", motivo: "Proposta não encontrada." };
  if (r.status === "aplicada") return { ok: true, status: "aplicada", already: true };
  if (r.status === "aplicando") {
    // Ainda gravando (outro clique ou o agente): não diz "aplicada" antes da hora. Presa há muito tempo → falhou.
    if (now.getTime() - r.createdAt.getTime() > PROPOSAL_TTL_MS + APPLYING_STALE_MS) {
      await db.update(agentProposals).set({ status: "falhou", error: "reserva_presa", decidedAt: now }).where(and(eq(agentProposals.id, r.id), eq(agentProposals.status, "aplicando")));
      return { ok: false, status: "falhou", motivo: "Essa proposta não pôde ser aplicada. Confira a tela e peça de novo." };
    }
    return { ok: false, status: "em_andamento", motivo: "Essa proposta está sendo aplicada agora. Confira a tela em instantes." };
  }
  if (r.status === "descartada") return { ok: false, status: "descartada", motivo: "Essa proposta foi descartada." };
  if (r.status === "falhou") return { ok: false, status: "falhou", motivo: "Essa proposta não pôde ser aplicada." };
  return { ok: false, status: "expirada", motivo: "A proposta venceu (30 minutos). Peça de novo para ver a versão atual." };
}
