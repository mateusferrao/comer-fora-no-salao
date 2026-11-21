/**
 * Propostas do copiloto e do MCP (S8 — D260, D261, D267): o que a IA pede vira uma proposta com ids já resolvidos pelo
 * código; esta prévia pura diz, em linguagem do dono, o que muda (antes → depois), o alcance, o custo calculado pelo
 * código e os avisos — ou recusa com a regra. A aplicação revalida tudo na hora de gravar (as mesmas funções das
 * Configurações), então a prévia nunca é a última palavra; ela usa as MESMAS regras puras (`checkOffer`, `validateSlot`).
 */
import { z } from "zod";
import type { MenuCategory, MenuItem } from "@/src/modules/beneficios/domain/menu";
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
};

export const ITEM_CHANGES = ["indisponivel", "disponivel", "fora_das_ofertas", "nas_ofertas", "preco"] as const;
export type ItemChange = (typeof ITEM_CHANGES)[number];

export type ProposalPayload =
  | { acao: "oferta"; papel: Role; slotId?: string; offer: OfferInput; weeklyCap?: number; inviteText?: string }
  | { acao: "item"; itemId: string; mudanca: ItemChange; priceCents?: number }
  | { acao: "faixa"; slotId: string; mudanca: "editar" | "desativar"; days?: number[]; startMin?: number; endMin?: number; intensity?: Intensity; extraTables?: number };

/** Contrato da proposta para quem chama de fora (MCP — D269): ids reais, o código confere tudo na prévia. */
const uuid = z.string().uuid();
const minutes = z.number().int().min(0).max(1440);
export const proposalPayloadSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("oferta"), papel: z.enum(["agora", "recompensa", "convite"]), slotId: uuid.optional(), offer: z.object({ kind: z.enum(OFFER_KINDS), itemId: uuid, pct: z.number().int().min(1).max(100).optional() }), weeklyCap: z.number().int().min(1).max(999).optional(), inviteText: z.string().max(300).optional() }),
  z.object({ acao: z.literal("item"), itemId: uuid, mudanca: z.enum(ITEM_CHANGES), priceCents: z.number().int().min(0).max(1_000_000).optional() }),
  z.object({ acao: z.literal("faixa"), slotId: uuid, mudanca: z.enum(["editar", "desativar"]), days: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(), startMin: minutes.optional(), endMin: minutes.optional(), intensity: z.enum(INTENSITIES).optional(), extraTables: z.number().int().min(1).max(200).optional() }),
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
  aba: "agora" | "cartela" | "convites" | "cardapio";
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

export function previewProposal(snap: Snapshot, p: ProposalPayload): Preview {
  switch (p.acao) {
    case "oferta":
      return previewOffer(snap, p);
    case "item":
      return previewItem(snap, p);
    case "faixa":
      return previewSlot(snap, p);
  }
}

export { ROLE_NAME };
