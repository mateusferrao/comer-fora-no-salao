/**
 * Propostas do copiloto e do MCP (S8 — D260, D261, D267): o que a IA pede vira uma proposta com ids já resolvidos pelo
 * código; esta prévia pura diz, em linguagem do dono, o que muda (antes → depois), o alcance, o custo calculado pelo
 * código e os avisos — ou recusa com a regra. A aplicação revalida tudo na hora de gravar (as mesmas funções das
 * Configurações), então a prévia nunca é a última palavra; ela usa as MESMAS regras puras (`checkOffer`, `validateSlot`).
 */
import { z } from "zod";
import { CATEGORY_LABELS, MENU_CATEGORIES, type MenuCategory, type MenuItem } from "@/src/modules/beneficios/domain/menu";
import { checkOffer, describeOffer, OFFER_KINDS, offerFromInput, unitCost, type OfferError, type OfferKind } from "@/src/modules/beneficios/domain/offers";
import { INTENSITIES, INTENSITY_LABEL, validateSlot, type Intensity, type OpeningHours } from "@/src/modules/beneficios/domain/slots";
import { slotLabel } from "@/src/modules/beneficios/domain/slot-text";

export type OfferInput = { kind: OfferKind; itemId: string; pct?: number };
export type Role = "agora" | "recompensa" | "convite";

/** Retrato do restaurante para a prévia (montado de `getSettingsView`). */
export type Snapshot = {
  marginPct: number | null;
  opening: OpeningHours;
  agora: OfferInput | null;
  recompensa: OfferInput | null;
  slots: Array<{ id: string; days: number[]; startMin: number; endMin: number; intensity: Intensity; extraTables: number; offer: OfferInput | null; weeklyCap: number | null; inviteText: string }>;
  menu: Array<{ id: string; name: string; category: MenuCategory; priceCents: number; active: boolean; inUse: boolean; offerAllowed: boolean }>;
  /** Onda 2 (D270). */
  tone?: string | null;
  ticketCents?: number | null;
  resumo?: { on: boolean; weekday: number; minute: number };
  /** Plano mais recente ainda proposto (aprovar pelo copiloto). */
  plan?: { id: string; slots: Array<{ slotId: string; offer: OfferInput; weeklyCap: number; inviteText: string }>; audience: number } | null;
};

export const ITEM_CHANGES = ["indisponivel", "disponivel", "fora_das_ofertas", "nas_ofertas", "preco"] as const;
export type ItemChange = (typeof ITEM_CHANGES)[number];

export type ProposalPayload =
  | { acao: "oferta"; papel: Role; slotId?: string; offer: OfferInput; weeklyCap?: number; inviteText?: string }
  | { acao: "item"; itemId: string; mudanca: ItemChange; priceCents?: number }
  | { acao: "faixa"; slotId: string; mudanca: "editar" | "desativar"; days?: number[]; startMin?: number; endMin?: number; intensity?: Intensity; extraTables?: number }
  // Onda 2 (D270): aprovar o plano (com uma troca opcional), tom, item novo, ticket/margem e resumo semanal.
  | { acao: "plano"; planId: string; slotId?: string; offer?: OfferInput; weeklyCap?: number }
  | { acao: "tom"; tone: string }
  | { acao: "item_novo"; name: string; category: MenuCategory; priceCents: number }
  | { acao: "restaurante"; ticketCents?: number | null; marginPct?: number | null }
  | { acao: "avisos"; resumoOn?: boolean; weekday?: number; minute?: number };

/** Contrato da proposta para quem chama de fora (MCP — D269): ids reais, o código confere tudo na prévia. */
const uuid = z.string().uuid();
const minutes = z.number().int().min(0).max(1440);
export const proposalPayloadSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("oferta"), papel: z.enum(["agora", "recompensa", "convite"]), slotId: uuid.optional(), offer: z.object({ kind: z.enum(OFFER_KINDS), itemId: uuid, pct: z.number().int().min(1).max(100).optional() }), weeklyCap: z.number().int().min(1).max(999).optional(), inviteText: z.string().max(300).optional() }),
  z.object({ acao: z.literal("item"), itemId: uuid, mudanca: z.enum(ITEM_CHANGES), priceCents: z.number().int().min(0).max(1_000_000).optional() }),
  z.object({ acao: z.literal("faixa"), slotId: uuid, mudanca: z.enum(["editar", "desativar"]), days: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(), startMin: minutes.optional(), endMin: minutes.optional(), intensity: z.enum(INTENSITIES).optional(), extraTables: z.number().int().min(1).max(200).optional() }),
  z.object({ acao: z.literal("plano"), planId: uuid, slotId: uuid.optional(), offer: z.object({ kind: z.enum(OFFER_KINDS), itemId: uuid, pct: z.number().int().min(1).max(100).optional() }).optional(), weeklyCap: z.number().int().min(1).max(999).optional() }),
  z.object({ acao: z.literal("tom"), tone: z.string().max(200) }),
  z.object({ acao: z.literal("item_novo"), name: z.string().min(2).max(120), category: z.enum(MENU_CATEGORIES), priceCents: z.number().int().min(0).max(1_000_000) }),
  z.object({ acao: z.literal("restaurante"), ticketCents: z.number().int().min(100).max(1_000_000).nullable().optional(), marginPct: z.number().int().min(1).max(95).nullable().optional() }),
  z.object({ acao: z.literal("avisos"), resumoOn: z.boolean().optional(), weekday: z.number().int().min(0).max(6).optional(), minute: z.number().int().min(360).max(1320).refine((m) => m % 30 === 0).optional() }),
]);

export type PreviewLine = { campo: string; antes: string; depois: string };
export type PreviewOk = {
  ok: true;
  titulo: string;
  linhas: PreviewLine[];
  alcance?: string;
  impacto?: string;
  avisos: string[];
  /** Aba de Configurações onde a mesma mudança se faz à mão ("Editar no formulário"). */
  aba: "agora" | "cartela" | "convites" | "cardapio" | "restaurante" | "ia" | "avisos" | "plano";
  /** Estado canônico do alvo antes da mudança (o `base_hash` sai daqui). */
  antes: unknown;
  /** Convite: o texto que será gravado (atual, novo ou o padrão). */
  inviteText?: string;
};
export type Preview = PreviewOk | { ok: false; motivo: string };

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (c: number) => BRL.format(c / 100).replace(/\s/g, " ");
const ROLE_NAME: Record<Role, string> = { agora: "o benefício de 1ª visita", recompensa: "a recompensa da cartela", convite: "o convite" };
export const DEFAULT_INVITE = (slotId: string) => `Volte {horario:${slotId}} e aproveite {oferta}.`;

const OFFER_ERR: Record<OfferError, string> = {
  parametros_invalidos: "A oferta está incompleta.",
  item_inexistente: "Esse prato não está ativo no cardápio.",
  categoria_incompativel: "Esse tipo de oferta não combina com a categoria do prato.",
  desconto_acima_do_teto: "O desconto passa do teto de 50%.",
  item_fora_das_ofertas: "",
};

const sameOffer = (a: OfferInput | null, b: OfferInput) => !!a && a.kind === b.kind && a.itemId === b.itemId && (a.pct ?? null) === (b.pct ?? null);

function menuOf(snap: Snapshot): MenuItem[] {
  return snap.menu.map((m) => ({ id: m.id, name: m.name, category: m.category, priceCents: m.priceCents }));
}

/** Onde o item está em uso (para explicar a recusa do código). */
function usageOf(snap: Snapshot, itemId: string): string | null {
  if (snap.agora?.itemId === itemId) return "é o benefício de 1ª visita";
  if (snap.recompensa?.itemId === itemId) return "é a recompensa da cartela";
  const s = snap.slots.find((x) => x.offer?.itemId === itemId);
  return s ? `está no convite de ${slotLabel(s)}` : null;
}

function previewOffer(snap: Snapshot, p: Extract<ProposalPayload, { acao: "oferta" }>): Preview {
  const menu = menuOf(snap);
  const active = snap.menu.filter((m) => m.active);
  const offer = offerFromInput(p.offer);
  const item = snap.menu.find((m) => m.id === p.offer.itemId);
  if (!item) return { ok: false, motivo: "Não encontrei esse prato no cardápio." };
  const errs = checkOffer(offer, menuOf({ ...snap, menu: active }), snap.menu.filter((m) => !m.offerAllowed).map((m) => m.id));
  if (errs.includes("item_fora_das_ofertas")) return { ok: false, motivo: `“${item.name}” está marcado como fora das ofertas.` };
  if (errs.length) return { ok: false, motivo: OFFER_ERR[errs[0]!] };
  const gain = describeOffer(offer, menu, p.papel).gain;
  const cost = unitCost(offer, menu, snap.marginPct ?? undefined);
  if (p.papel !== "convite") {
    const cur = p.papel === "agora" ? snap.agora : snap.recompensa;
    if (sameOffer(cur, p.offer)) return { ok: false, motivo: "Isso já está assim." };
    const before = cur ? describeOffer(offerFromInput(cur), menu, p.papel).gain : "—";
    return {
      ok: true,
      titulo: p.papel === "agora" ? "Trocar o benefício de 1ª visita" : "Trocar a recompensa da cartela",
      linhas: [{ campo: "Oferta", antes: before, depois: gain }],
      alcance: p.papel === "agora" ? "Vale para quem faz o 1º check-in" : "Vale para quem completa a cartela",
      impacto: `Custo de cada ${p.papel === "agora" ? "benefício" : "recompensa"}: ${cost.isMax ? "até " : ""}${money(cost.cents)}`,
      avisos: p.papel === "agora" ? ["Quem já ganhou o benefício de 1ª visita não ganha de novo."] : [],
      aba: p.papel === "agora" ? "agora" : "cartela",
      antes: { papel: p.papel, offer: cur },
    };
  }
  const slot = snap.slots.find((s) => s.id === p.slotId);
  if (!slot) return { ok: false, motivo: "Não encontrei esse horário vazio." };
  const cap = Math.max(1, Math.min(999, Math.round(p.weeklyCap ?? slot.weeklyCap ?? 4)));
  const capBefore = slot.weeklyCap ?? 4;
  const newText = p.inviteText?.trim();
  const avisos: string[] = [];
  let inviteText = slot.inviteText || DEFAULT_INVITE(slot.id);
  if (newText) inviteText = newText;
  else if ([...inviteText.matchAll(/\{prato:([^}]+)\}/g)].some((m) => m[1] !== p.offer.itemId)) {
    inviteText = DEFAULT_INVITE(slot.id);
    avisos.push("O texto do convite citava o prato antigo e volta ao texto padrão.");
  }
  if (sameOffer(slot.offer, p.offer) && cap === capBefore && inviteText === (slot.inviteText || DEFAULT_INVITE(slot.id))) return { ok: false, motivo: "Isso já está assim." };
  const linhas: PreviewLine[] = [];
  if (!sameOffer(slot.offer, p.offer)) linhas.push({ campo: "Oferta", antes: slot.offer ? describeOffer(offerFromInput(slot.offer), menu, "convite").gain : "—", depois: gain });
  if (cap !== capBefore) linhas.push({ campo: "Teto semanal", antes: `${capBefore} convites`, depois: `${cap} convites` });
  if (newText) linhas.push({ campo: "Texto do convite", antes: slot.inviteText ? "texto atual" : "—", depois: "texto novo (veja abaixo)" });
  // Revisão S8 (produto 12, H4): o custo máximo antes → depois, calculado pelo código.
  const costBefore = slot.offer ? unitCost(offerFromInput(slot.offer), menu, snap.marginPct ?? undefined).cents * capBefore : null;
  if (costBefore !== null && costBefore !== cost.cents * cap) linhas.push({ campo: "Custo máximo por semana", antes: money(costBefore), depois: money(cost.cents * cap) });
  if (!sameOffer(slot.offer, p.offer)) avisos.unshift("Convites já emitidos continuam com a oferta antiga.");
  return {
    ok: true,
    titulo: `Trocar ${linhas.length === 1 && linhas[0]!.campo === "Teto semanal" ? "o teto" : "a oferta"} do convite de ${slotLabel(slot)}`,
    linhas,
    alcance: `Vale para ${slotLabel(slot)}`,
    impacto: `Até ${cap} convites por semana · custo máximo de ${cost.isMax ? "até " : ""}${money(cost.cents * cap)} por semana`,
    avisos,
    aba: "convites",
    antes: { slotId: slot.id, offer: slot.offer, weeklyCap: slot.weeklyCap, inviteText: slot.inviteText },
    inviteText,
  };
}

function previewItem(snap: Snapshot, p: Extract<ProposalPayload, { acao: "item" }>): Preview {
  const it = snap.menu.find((m) => m.id === p.itemId);
  if (!it) return { ok: false, motivo: "Não encontrei esse prato no cardápio." };
  const antes = { id: it.id, active: it.active, offerAllowed: it.offerAllowed, priceCents: it.priceCents };
  const base = { ok: true as const, aba: "cardapio" as const, antes, avisos: [] as string[] };
  const yes = (b: boolean) => (b ? "Sim" : "Não");
  switch (p.mudanca) {
    case "indisponivel": {
      if (!it.active) return { ok: false, motivo: "Esse prato já está fora do cardápio." };
      const use = usageOf(snap, it.id);
      if (use) {
        const what = use.startsWith("é a recompensa") ? "a recompensa" : use.startsWith("é o benefício") ? "o benefício de 1ª visita" : "a oferta desse convite";
        return { ok: false, motivo: `“${it.name}” ${use}. Troque ${what} antes de tirar o prato do cardápio.` };
      }
      return { ...base, titulo: `Tirar “${it.name}” do cardápio`, linhas: [{ campo: "No cardápio", antes: "Sim", depois: "Não" }], avisos: ["Some das ofertas e das opções da IA até voltar ao cardápio. Não existe “pausar só hoje”: volte quando quiser."] };
    }
    case "disponivel":
      if (it.active) return { ok: false, motivo: "Esse prato já está no cardápio." };
      return { ...base, titulo: `Voltar “${it.name}” ao cardápio`, linhas: [{ campo: "No cardápio", antes: "Não", depois: "Sim" }] };
    case "fora_das_ofertas":
      if (!it.offerAllowed) return { ok: false, motivo: "Esse prato já está fora das ofertas." };
      return {
        ...base,
        titulo: `Tirar “${it.name}” das ofertas`,
        linhas: [{ campo: "Pode entrar em ofertas", antes: yes(true), depois: yes(false) }],
        avisos: it.inUse ? ["A oferta em vigor com esse prato continua até você trocá-la."] : [],
      };
    case "nas_ofertas":
      if (it.offerAllowed) return { ok: false, motivo: "Esse prato já pode entrar em ofertas." };
      return { ...base, titulo: `Deixar “${it.name}” entrar em ofertas`, linhas: [{ campo: "Pode entrar em ofertas", antes: yes(false), depois: yes(true) }] };
    case "preco": {
      const c = Math.round(p.priceCents ?? -1);
      if (c < 0 || c > 1_000_000) return { ok: false, motivo: "Preço inválido." };
      if (c === it.priceCents) return { ok: false, motivo: "Isso já está assim." };
      return {
        ...base,
        titulo: `Mudar o preço de “${it.name}”`,
        linhas: [{ campo: "Preço", antes: money(it.priceCents), depois: money(c) }],
        avisos: it.inUse ? ["O custo das ofertas com esse prato muda junto."] : [],
      };
    }
  }
}

function previewSlot(snap: Snapshot, p: Extract<ProposalPayload, { acao: "faixa" }>): Preview {
  const s = snap.slots.find((x) => x.id === p.slotId);
  if (!s) return { ok: false, motivo: "Não encontrei esse horário vazio." };
  const antes = { id: s.id, days: s.days, startMin: s.startMin, endMin: s.endMin, intensity: s.intensity, extraTables: s.extraTables };
  if (p.mudanca === "desativar") {
    if (snap.slots.length <= 1) return { ok: false, motivo: "É o único horário vazio: o convite precisa de pelo menos um." };
    return { ok: true, titulo: `Parar o convite de ${slotLabel(s)}`, linhas: [{ campo: "Convite neste horário", antes: "Ligado", depois: "Desligado" }], avisos: ["Convites já emitidos para esse horário continuam valendo."], aba: "convites", antes };
  }
  const next = { ...antes, ...(p.days ? { days: [...new Set(p.days)].sort() } : {}), ...(p.startMin !== undefined ? { startMin: p.startMin } : {}), ...(p.endMin !== undefined ? { endMin: p.endMin } : {}), ...(p.intensity ? { intensity: p.intensity } : {}), ...(p.extraTables !== undefined ? { extraTables: p.extraTables } : {}) };
  const errs = validateSlot(next, snap.opening);
  if (errs.includes("dias_vazios")) return { ok: false, motivo: "Escolha pelo menos um dia." };
  if (errs.includes("horario_invalido")) return { ok: false, motivo: "O horário de fim precisa ser depois do início, no mesmo dia." };
  if (errs.includes("fora_do_funcionamento")) return { ok: false, motivo: "O horário fica fora do funcionamento do restaurante." };
  if (next.extraTables < 1 || next.extraTables > 200) return { ok: false, motivo: "A meta de mesas precisa ficar entre 1 e 200." };
  const linhas: PreviewLine[] = [];
  if (slotLabel(next) !== slotLabel(s)) linhas.push({ campo: "Horário", antes: slotLabel(s), depois: slotLabel(next) });
  if (next.intensity !== s.intensity) linhas.push({ campo: "Quanto fica vazio", antes: INTENSITY_LABEL[s.intensity], depois: INTENSITY_LABEL[next.intensity] });
  if (next.extraTables !== s.extraTables) linhas.push({ campo: "Mesas a mais por semana", antes: String(s.extraTables), depois: String(next.extraTables) });
  if (!linhas.length) return { ok: false, motivo: "Isso já está assim." };
  return { ok: true, titulo: `Ajustar o horário vazio ${slotLabel(s)}`, linhas, alcance: `Vale para ${slotLabel(next)}`, avisos: ["Convites já emitidos guardam o horário de quando foram emitidos."], aba: "convites", antes };
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function previewPlan(snap: Snapshot, p: Extract<ProposalPayload, { acao: "plano" }>): Preview {
  const plan = snap.plan;
  if (!plan || plan.id !== p.planId) return { ok: false, motivo: "Não há plano da semana esperando aprovação. Gere o plano na aba Plano da semana." };
  const menu = menuOf(snap);
  const linhas: PreviewLine[] = [];
  const avisos: string[] = [];
  if (p.slotId) {
    const s = plan.slots.find((x) => x.slotId === p.slotId);
    const slot = snap.slots.find((x) => x.id === p.slotId);
    if (!s || !slot) return { ok: false, motivo: "Esse horário não está no plano." };
    if (p.offer) {
      const errs = checkOffer(offerFromInput(p.offer), menuOf({ ...snap, menu: snap.menu.filter((m) => m.active) }), snap.menu.filter((m) => !m.offerAllowed).map((m) => m.id));
      if (errs.length) return { ok: false, motivo: errs[0] === "item_fora_das_ofertas" ? "Esse prato está marcado como fora das ofertas." : OFFER_ERR[errs[0]!] };
      if (!sameOffer(s.offer, p.offer)) linhas.push({ campo: `Oferta de ${slotLabel(slot)}`, antes: describeOffer(offerFromInput(s.offer), menu, "convite").gain, depois: describeOffer(offerFromInput(p.offer), menu, "convite").gain });
      if ([...s.inviteText.matchAll(/\{prato:([^}]+)\}/g)].some((m) => m[1] !== p.offer!.itemId)) avisos.push("O texto do convite desse horário citava o prato antigo e volta ao texto padrão.");
    }
    if (p.weeklyCap && p.weeklyCap !== s.weeklyCap) linhas.push({ campo: `Teto de ${slotLabel(slot)}`, antes: `${s.weeklyCap} convites`, depois: `${p.weeklyCap} convites` });
  }
  linhas.push({ campo: "Plano da semana", antes: "Proposto", depois: "Aprovado" });
  if (plan.audience > 0) avisos.unshift(`Ao aprovar, o convite de volta vai para até ${plan.audience} clientes (no app e por e-mail para quem aceitou).`);
  return { ok: true, titulo: linhas.length > 1 ? "Aprovar o plano da semana com ajuste" : "Aprovar o plano da semana", linhas, avisos, aba: "plano", antes: { planId: plan.id, slots: plan.slots } };
}

function previewOther(snap: Snapshot, p: Extract<ProposalPayload, { acao: "tom" | "item_novo" | "restaurante" | "avisos" }>): Preview {
  switch (p.acao) {
    case "tom": {
      const t = p.tone.trim().replace(/\s+/g, " ");
      if ((snap.tone ?? "") === t) return { ok: false, motivo: "Isso já está assim." };
      return { ok: true, titulo: "Mudar o tom dos textos da IA", linhas: [{ campo: "Tom", antes: snap.tone || "padrão", depois: t || "padrão" }], avisos: ["Vale para os próximos textos da IA; os convites atuais não mudam."], aba: "ia", antes: { tone: snap.tone ?? null } };
    }
    case "item_novo": {
      const name = p.name.trim();
      if (snap.menu.some((m) => m.name.toLowerCase() === name.toLowerCase() && m.active)) return { ok: false, motivo: "Já existe um prato com esse nome no cardápio." };
      return { ok: true, titulo: `Incluir “${name}” no cardápio`, linhas: [{ campo: "Prato novo", antes: "—", depois: `${name} · ${CATEGORY_LABELS[p.category]} · ${money(p.priceCents)}` }], avisos: [], aba: "cardapio", antes: { names: snap.menu.map((m) => m.name).sort() } };
    }
    case "restaurante": {
      const linhas: PreviewLine[] = [];
      if (p.ticketCents !== undefined && p.ticketCents !== (snap.ticketCents ?? null)) linhas.push({ campo: "Ticket médio por pessoa", antes: snap.ticketCents ? money(snap.ticketCents) : "não informado", depois: p.ticketCents ? money(p.ticketCents) : "não informado" });
      if (p.marginPct !== undefined && p.marginPct !== snap.marginPct) linhas.push({ campo: "Margem aproximada", antes: snap.marginPct ? `${snap.marginPct}%` : "não informada", depois: p.marginPct ? `${p.marginPct}%` : "não informada" });
      if (!linhas.length) return { ok: false, motivo: "Isso já está assim." };
      return { ok: true, titulo: "Atualizar ticket e margem", linhas, avisos: ["Muda o cálculo de custo e de retorno em reais daqui para a frente."], aba: "restaurante", antes: { ticketCents: snap.ticketCents ?? null, marginPct: snap.marginPct } };
    }
    case "avisos": {
      const cur = snap.resumo ?? { on: true, weekday: 1, minute: 510 };
      const next = { on: p.resumoOn ?? cur.on, weekday: p.weekday ?? cur.weekday, minute: p.minute ?? cur.minute };
      if (next.minute % 30 !== 0) return { ok: false, motivo: "O horário do resumo precisa ser em hora cheia ou meia hora." };
      const show = (r: typeof cur) => (r.on ? `${WEEKDAYS[r.weekday]}, ${hhmm(r.minute)}` : "desligado");
      if (show(next) === show(cur)) return { ok: false, motivo: "Isso já está assim." };
      return { ok: true, titulo: "Mudar o resumo semanal por e-mail", linhas: [{ campo: "Resumo da semana", antes: show(cur), depois: show(next) }], avisos: [], aba: "avisos", antes: { resumo: cur } };
    }
  }
}

export function previewProposal(snap: Snapshot, p: ProposalPayload): Preview {
  switch (p.acao) {
    case "plano":
      return previewPlan(snap, p);
    case "tom":
    case "item_novo":
    case "restaurante":
    case "avisos":
      return previewOther(snap, p);
    case "oferta":
      return previewOffer(snap, p);
    case "item":
      return previewItem(snap, p);
    case "faixa":
      return previewSlot(snap, p);
  }
}

export { ROLE_NAME };
