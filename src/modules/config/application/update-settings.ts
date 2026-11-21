/**
 * Configurações (D120: depois da IA, tudo editável pelo dono). Toda mudança de oferta, teto ou texto cria
 * uma versão nova (a anterior ganha `superseded_at`); convites já emitidos guardam a versão e a faixa da
 * emissão (D218). Tudo vai para `owner_edits`.
 */
import { decryptEmail } from "@/src/shared/crypto";
import { parseNotifySettings, type NotifySettings } from "../domain/notify-settings";
import { mentionsIfood } from "@/src/shared/brand";
import { findAvoided, ownerDataOf, parseAiFeatures, validateAbout, validateAvoid, type AiFeatures } from "../domain/ai-profile";
import { and, desc, eq, isNull, max, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Executor, Tx } from "@/src/db/executor";
import { benefits, benefitVersions, idleSlots, menuItems, menus, ownerEdits, owners, restaurants } from "@/src/db/schema";
import type { MenuCategory } from "@/src/modules/beneficios/domain/menu";
import { describeOffer, MAX_DISCOUNT_PCT, validateOffer, type Offer, type OfferError, type OfferKind, offerFromInput } from "@/src/modules/beneficios/domain/offers";
import { validateSlot, type OpeningHours, type Slot, type SlotError } from "@/src/modules/beneficios/domain/slots";
import { guardText } from "@/src/modules/ia/guardrails";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { gatewayFor, keyKindFor } from "@/src/modules/ia/gateway-factory";
import { MODELS } from "@/src/modules/ia/models";
import { runTask } from "@/src/modules/ia/run-task";
import { recordAiCall } from "@/src/modules/ia/ai-calls";
import { langfuseTracer } from "@/src/modules/ia/tracing";
import { buildPackagePrompt, buildPackageTask, PACKAGE_PROMPT_VERSION, resolvePackage } from "@/src/modules/ia/tasks/package";
import { buildCandidates, fallbackChoices, weeklyCapFor } from "@/src/modules/onboarding/domain/candidates";
import { declaredFacts } from "@/src/modules/onboarding/domain/facts";
import { slotLabel, slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import { cleanItemName } from "@/src/modules/onboarding/domain/menu-extraction";
import { loadContext } from "@/src/modules/salao/application/context";
import { renderReferences } from "@/src/modules/textos/domain/references";
import { systemClock } from "@/src/shared/clock";
import { consume } from "@/src/shared/rate-limit";
import { getActivePrompt, promptSuffix } from "./app-config";
import { validateTone, type ToneError } from "../domain/tone";
import { FORBIDDEN } from "@/src/modules/ia/guardrails";

export const MAX_SLOTS = 8;

export type OfferInput = { kind: OfferKind; itemId: string; pct?: number };
const toOffer = (o: { kind: OfferKind; itemId: string; pct?: number }): Offer => offerFromInput(o);

export type SettingsResult = { ok: true; warnings?: string[] } | { ok: false; erro: "oferta"; erros: OfferError[] } | { ok: false; erro: "texto"; motivos: string[] } | { ok: false; erro: "nao_encontrado" | "em_uso" | "ultima_faixa" | "sem_opcao" | "nome_marca" };

/**
 * Cria a versão nova de um benefício (a vigente ganha `superseded_at`). Roda dentro da transação do chamador,
 * que já travou a linha do restaurante (Configurações e aprovação do plano — revisão T-I7).
 */
export async function newOfferVersion(
  tx: Tx,
  p: { restaurantId: string; role: "agora" | "recompensa" | "convite"; slotId?: string; offer: Offer; weeklyCap?: number | null; inviteText: string | null; planId?: string | null; now: Date },
): Promise<{ versionId: string; previous: typeof benefitVersions.$inferSelect | undefined }> {
  const where = p.role === "convite" ? and(eq(benefits.restaurantId, p.restaurantId), eq(benefits.role, "convite"), eq(benefits.slotId, p.slotId!)) : and(eq(benefits.restaurantId, p.restaurantId), eq(benefits.role, p.role));
  let [b] = await tx.select({ id: benefits.id }).from(benefits).where(where).limit(1);
  if (!b) [b] = await tx.insert(benefits).values({ restaurantId: p.restaurantId, role: p.role, slotId: p.role === "convite" ? p.slotId! : null, createdAt: p.now }).returning({ id: benefits.id });
  const [cur] = await tx.select().from(benefitVersions).where(and(eq(benefitVersions.benefitId, b!.id), isNull(benefitVersions.supersededAt))).for("update");
  const [{ v }] = (await tx.select({ v: max(benefitVersions.version) }).from(benefitVersions).where(eq(benefitVersions.benefitId, b!.id))) as [{ v: number | null }];
  if (cur) await tx.update(benefitVersions).set({ supersededAt: p.now }).where(eq(benefitVersions.id, cur.id));
  const [row] = await tx
    .insert(benefitVersions)
    .values({
      benefitId: b!.id,
      restaurantId: p.restaurantId,
      version: (v ?? 0) + 1,
      kind: p.offer.kind,
      params: p.offer.params,
      weeklyCap: p.role === "convite" ? Math.max(1, Math.min(999, p.weeklyCap ?? cur?.weeklyCap ?? 4)) : null,
      planId: p.planId ?? null,
      validFrom: p.now,
      inviteText: p.inviteText,
      createdAt: p.now,
    })
    .returning({ id: benefitVersions.id });
  return { versionId: row!.id, previous: cur };
}

export async function updateOffer(
  db: Db,
  p: { restaurantId: string; role: "agora" | "recompensa" | "convite"; slotId?: string; offer: OfferInput; weeklyCap?: number; inviteText?: string; now: Date },
): Promise<SettingsResult> {
  const ctx = await loadContext(db, p.restaurantId);
  if (!ctx) return { ok: false, erro: "nao_encontrado" };
  const activeMenu = await db.select({ id: menuItems.id, category: menuItems.category, name: menuItems.name, priceCents: menuItems.priceCents }).from(menuItems).where(and(eq(menuItems.restaurantId, p.restaurantId), eq(menuItems.active, true)));
  const menu = activeMenu.map((m) => ({ ...m, category: m.category as MenuCategory }));
  const offer = toOffer(p.offer);
  const errs = validateOffer(offer, menu);
  // S6.3a (D197): item "fora das ofertas" não vira oferta nova.
  if (ctx.noOfferItemIds.includes(offer.params.itemId)) errs.push("item_fora_das_ofertas");
  if (offer.kind === "desconto" && (offer.params.pct ?? 0) > MAX_DISCOUNT_PCT && !errs.includes("desconto_acima_do_teto")) errs.push("desconto_acima_do_teto");
  if (errs.length) return { ok: false, erro: "oferta", erros: errs };
  let inviteText: string | null = null;
  let warnings: string[] = [];
  if (p.role === "convite") {
    const slot = ctx.slots.find((s) => s.id === p.slotId);
    if (!slot) return { ok: false, erro: "nao_encontrado" };
    if (p.inviteText?.trim()) {
      const g = guardText(p.inviteText, { items: Object.fromEntries(ctx.menu.map((m) => [m.id, m.name])), slots: { [slot.id]: slotPhrase(slot) }, oferta: describeOffer(offer, menu, "convite").gain }, { allowed: ["prato", "horario", "oferta"], maxLen: 160, field: "textoConvite", mode: "dono" });
      if (!g.ok) return { ok: false, erro: "texto", motivos: g.reasons };
      warnings = g.warnings;
      inviteText = p.inviteText.trim();
      // Revisão S2 #31: o texto cita um prato que não é o da nova oferta (aviso, não bloqueio).
      const itemId = (offer.params as { itemId?: string }).itemId;
      const cited = [...inviteText.matchAll(/\{prato:([^}]+)\}/g)].map((m) => m[1]);
      if (cited.some((id) => id !== itemId)) warnings.push("prato_fora_da_oferta");
    }
  }
  return db.transaction(async (tx) => {
    // Serializa as edições do restaurante: sem isso, duas edições simultâneas criavam duas versões vigentes
    // (o FOR UPDATE com `superseded_at is null` reavaliado devolvia vazio — revisão da S2). Índice único na 0003.
    await tx.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.id, p.restaurantId)).for("update");
    const { previous: cur } = await newOfferVersion(tx, { restaurantId: p.restaurantId, role: p.role, slotId: p.slotId, offer, weeklyCap: p.weeklyCap, inviteText, now: p.now });
    await tx.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: `config:${p.role}`, ref: p.slotId ?? null, suggested: cur ? { kind: cur.kind, params: cur.params, weeklyCap: cur.weeklyCap, inviteText: cur.inviteText } : null, final: { ...p.offer, weeklyCap: p.weeklyCap ?? null, inviteText }, at: p.now });
    return { ok: true as const, warnings };
  });
}

async function itemInUse(db: Executor, restaurantId: string, itemId: string): Promise<boolean> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(benefitVersions)
    .innerJoin(benefits, eq(benefits.id, benefitVersions.benefitId))
    .where(and(eq(benefitVersions.restaurantId, restaurantId), isNull(benefitVersions.supersededAt), sql`${benefitVersions.params}->>'itemId' = ${itemId}`));
  return (r?.n ?? 0) > 0;
}

/** Item em versão vigente não sai do cardápio ("troque a oferta antes" — revisão T-I12). */
export async function setMenuItemActive(db: Db, p: { restaurantId: string; itemId: string; active: boolean; now: Date }): Promise<SettingsResult> {
  if (!p.active && (await itemInUse(db, p.restaurantId, p.itemId))) return { ok: false, erro: "em_uso" };
  const upd = await db.update(menuItems).set({ active: p.active }).where(and(eq(menuItems.id, p.itemId), eq(menuItems.restaurantId, p.restaurantId))).returning({ id: menuItems.id });
  if (!upd.length) return { ok: false, erro: "nao_encontrado" };
  await db.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "config:cardapio", ref: p.itemId, suggested: null, final: { active: p.active }, at: p.now });
  return { ok: true };
}

export async function updateMenuItem(db: Db, p: { restaurantId: string; itemId: string; name: string; priceCents: number; category: MenuCategory; now: Date }): Promise<SettingsResult> {
  const [it] = await db.select().from(menuItems).where(and(eq(menuItems.id, p.itemId), eq(menuItems.restaurantId, p.restaurantId)));
  if (!it) return { ok: false, erro: "nao_encontrado" };
  if (it.category !== p.category && (await itemInUse(db, p.restaurantId, p.itemId))) return { ok: false, erro: "em_uso" };
  const name = cleanItemName(p.name);
  if (!name) return { ok: false, erro: "texto", motivos: ["vazio"] };
  await db.update(menuItems).set({ name, priceCents: Math.max(0, Math.round(p.priceCents)), category: p.category }).where(eq(menuItems.id, p.itemId));
  await db.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "config:cardapio", ref: p.itemId, suggested: { name: it.name, priceCents: it.priceCents, category: it.category }, final: { name, priceCents: p.priceCents, category: p.category }, at: p.now });
  return { ok: true };
}

export async function addMenuItem(db: Db, p: { restaurantId: string; name: string; priceCents: number; category: MenuCategory; now: Date }): Promise<{ ok: true; itemId: string } | { ok: false; erro: "texto" }> {
  const name = cleanItemName(p.name);
  if (!name) return { ok: false, erro: "texto" };
  let [menu] = await db.select({ id: menus.id }).from(menus).where(eq(menus.restaurantId, p.restaurantId)).orderBy(desc(menus.createdAt)).limit(1);
  if (!menu) [menu] = await db.insert(menus).values({ restaurantId: p.restaurantId, source: "manual", createdAt: p.now }).returning({ id: menus.id });
  const [{ pos }] = (await db.select({ pos: max(menuItems.position) }).from(menuItems).where(eq(menuItems.restaurantId, p.restaurantId))) as [{ pos: number | null }];
  const [row] = await db.insert(menuItems).values({ menuId: menu!.id, restaurantId: p.restaurantId, category: p.category, name, priceCents: Math.max(0, Math.round(p.priceCents)), position: (pos ?? 0) + 1 }).returning({ id: menuItems.id });
  return { ok: true, itemId: row!.id };
}

type SlotInput = { days: number[]; startMin: number; endMin: number; intensity: "muito" | "um_pouco"; extraTables: number };

async function opening(db: Db, restaurantId: string): Promise<OpeningHours> {
  const ctx = await loadContext(db, restaurantId);
  return ctx?.opening ?? [];
}

/** Editar faixa: mesmo id (convites guardam o snapshot — D218). */
export async function updateSlot(db: Db, p: { restaurantId: string; slotId: string } & SlotInput & { now: Date }): Promise<SettingsResult | { ok: false; erro: "faixa"; erros: SlotError[] }> {
  const errs = validateSlot({ id: p.slotId, ...p }, await opening(db, p.restaurantId));
  if (errs.length) return { ok: false, erro: "faixa", erros: errs };
  const upd = await db
    .update(idleSlots)
    .set({ days: p.days, startMin: p.startMin, endMin: p.endMin, intensity: p.intensity, extraTables: p.extraTables })
    .where(and(eq(idleSlots.id, p.slotId), eq(idleSlots.restaurantId, p.restaurantId)))
    .returning({ id: idleSlots.id });
  if (!upd.length) return { ok: false, erro: "nao_encontrado" };
  await db.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "config:faixa", ref: p.slotId, suggested: null, final: { days: p.days, startMin: p.startMin, endMin: p.endMin, intensity: p.intensity, extraTables: p.extraTables }, at: p.now });
  return { ok: true };
}

export async function deactivateSlot(db: Db, p: { restaurantId: string; slotId: string; now: Date }): Promise<SettingsResult> {
  const active = await db.select({ id: idleSlots.id }).from(idleSlots).where(and(eq(idleSlots.restaurantId, p.restaurantId), eq(idleSlots.active, true)));
  if (!active.some((s) => s.id === p.slotId)) return { ok: false, erro: "nao_encontrado" };
  if (active.length <= 1) return { ok: false, erro: "ultima_faixa" };
  await db.update(idleSlots).set({ active: false }).where(eq(idleSlots.id, p.slotId));
  await db.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "config:faixa", ref: p.slotId, suggested: null, final: { active: false }, at: p.now });
  return { ok: true };
}

/** Faixa nova: a oferta sai das candidatas (IA escolhe se houver; senão a de maior nota) e pode ser trocada depois. */
export async function addSlot(db: Db, p: { restaurantId: string; ownerId: string; now: Date; gateway?: AiGateway | null } & SlotInput): Promise<{ ok: true; slotId: string; generatedBy: "ia" | "sem_ia" } | { ok: false; erro: "faixa"; erros: SlotError[] } | { ok: false; erro: "sem_candidatas" | "nao_encontrado" | "limite_faixas" }> {
  const ctx = await loadContext(db, p.restaurantId);
  if (!ctx) return { ok: false, erro: "nao_encontrado" };
  const errs = validateSlot({ id: "nova", ...p }, ctx.opening);
  if (errs.length) return { ok: false, erro: "faixa", erros: errs };
  // Até 8 faixas ativas (apelidos A–H no prompt — revisão da S2).
  if (ctx.slots.length >= MAX_SLOTS) return { ok: false, erro: "limite_faixas" };
  // Id gerado antes: a faixa só é gravada junto com o convite, numa transação (revisão da S2).
  const slot: Slot = { id: crypto.randomUUID(), days: p.days, startMin: p.startMin, endMin: p.endMin, intensity: p.intensity, extraTables: p.extraTables };
  const activeMenu = ctx.menu; // inclui inativos; candidatas filtram pelos ativos abaixo
  const actives = await db.select({ id: menuItems.id }).from(menuItems).where(and(eq(menuItems.restaurantId, p.restaurantId), eq(menuItems.active, true)));
  const menu = activeMenu.filter((m) => actives.some((a) => a.id === m.id));
  const exclude = [ctx.agora?.offer.params.itemId, ctx.recompensa?.offer.params.itemId, ...ctx.noOfferItemIds].filter((x): x is string => !!x);
  const agoraItem = ctx.agora ? menu.find((m) => m.id === ctx.agora!.offer.params.itemId) : undefined;
  const cands = buildCandidates([slot], menu, { ticketCents: ctx.restaurant.ticketCents, marginPct: ctx.restaurant.marginPct, exclude, minValueCents: agoraItem?.priceCents });
  if (!cands[0]?.options.length) return { ok: false, erro: "sem_candidatas" };
  let choice = { candidateId: fallbackChoices([slot], cands)[0]!.candidateId, textoConvite: `Volte {horario:${slot.id}} e aproveite {oferta}.` };
  let generatedBy: "ia" | "sem_ia" = "sem_ia";
  const [owner] = await db.select({ emailHmac: owners.emailHmac, via: owners.via }).from(owners).where(eq(owners.id, p.ownerId));
  const keyKind = keyKindFor({ emailHmac: owner?.emailHmac ?? null, via: owner?.via ?? null });
  const gw = p.gateway !== undefined ? { gateway: p.gateway, keyKind } : await gatewayFor(db, keyKind, p.now);
  // A IA da faixa nova conta no limite do pacote (10/dia), não no das Configurações (revisão da S2).
  const aiAllowed = owner?.via === "e2e" || (await consume(db, `pacote:${p.restaurantId}`, 10, 86_400, p.now)).ok;
  if (gw.gateway && aiAllowed) {
    const prompt = await getActivePrompt(db, "pacote");
    const pp = buildPackagePrompt({ restaurantName: ctx.restaurant.name, cuisine: ctx.restaurant.cuisine, slots: [slot], cands, menu, facts: declaredFacts(ctx.restaurant, [slot], menu), instructions: prompt.instructions, tone: ctx.restaurant.aiTone, owner: ownerDataOf(ctx.restaurant) });
    const res = await runTask(buildPackageTask(pp, MODELS.pacote), pp.system, { text: pp.text }, { gateway: gw.gateway, clock: systemClock, trace: langfuseTracer });
    await recordAiCall(db, { task: "pacote", promptVersion: `${PACKAGE_PROMPT_VERSION}${promptSuffix(prompt, { tone: !!ctx.restaurant.aiTone })}`, restaurantId: p.restaurantId, result: res, keyKind: gw.keyKind });
    if (res.status === "ok") {
      const r = resolvePackage(pp, res.data)[0]!;
      choice = { candidateId: r.candidateId, textoConvite: r.textoConvite };
      generatedBy = "ia";
    }
  }
  const opt = cands[0].options.find((o) => o.id === choice.candidateId)!;
  await db.transaction(async (tx) => {
    await tx.insert(idleSlots).values({ id: slot.id, restaurantId: p.restaurantId, days: p.days, startMin: p.startMin, endMin: p.endMin, intensity: p.intensity, extraTables: p.extraTables, position: ctx.slots.length, createdAt: p.now });
    const [b] = await tx.insert(benefits).values({ restaurantId: p.restaurantId, role: "convite", slotId: slot.id, createdAt: p.now }).returning({ id: benefits.id });
    await tx.insert(benefitVersions).values({ benefitId: b!.id, restaurantId: p.restaurantId, version: 1, kind: opt.offer.kind, params: opt.offer.params, weeklyCap: weeklyCapFor(slot), validFrom: p.now, inviteText: choice.textoConvite, createdAt: p.now });
    await tx.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "config:faixa_nova", ref: slot.id, suggested: { candidateId: opt.id, generatedBy }, final: null, at: p.now });
  });
  return { ok: true, slotId: slot.id, generatedBy };
}

export async function updateRestaurantInfo(
  db: Db,
  p: { restaurantId: string; name: string; ticketCents: number | null; marginPct: number | null; tables: number | null; weeklyCustomers: number | null; description: string | null; address: string | null; opening: OpeningHours; now: Date },
): Promise<SettingsResult | { ok: false; erro: "funcionamento" }> {
  const ctx = await loadContext(db, p.restaurantId);
  if (!ctx) return { ok: false, erro: "nao_encontrado" };
  if (ctx.slots.some((s) => validateSlot(s, p.opening).length)) return { ok: false, erro: "funcionamento" };
  const name = cleanItemName(p.name).slice(0, 60);
  if (name.length < 2) return { ok: false, erro: "texto", motivos: ["nome"] };
  if (mentionsIfood(name)) return { ok: false, erro: "nome_marca" };
  await db
    .update(restaurants)
    .set({ name, ticketCents: p.ticketCents, marginPct: p.marginPct, tables: p.tables, weeklyCustomers: p.weeklyCustomers, description: p.description?.trim().slice(0, 400) || null, address: p.address?.trim().slice(0, 160) || null, openingHours: p.opening })
    .where(eq(restaurants.id, p.restaurantId));
  await db.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "config:restaurante", ref: null, suggested: null, final: { name, ticketCents: p.ticketCents, marginPct: p.marginPct }, at: p.now });
  return { ok: true };
}

// ---------- Vista das Configurações ----------
export type SettingsView = {
  restaurant: { aiTone: string | null; aiAbout: string | null; aiAvoid: string | null; aiFeatures: AiFeatures; name: string; kind: string; isCopy: boolean; ticketCents: number | null; marginPct: number | null; tables: number | null; weeklyCustomers: number | null; description: string | null; address: string | null; opening: OpeningHours };
  agora: OfferInput | null;
  recompensa: OfferInput | null;
  slots: Array<{ id: string; label: string; days: number[]; startMin: number; endMin: number; intensity: "muito" | "um_pouco"; extraTables: number; offer: OfferInput | null; weeklyCap: number | null; inviteText: string; inviteRendered: string }>;
  menu: Array<{ id: string; name: string; category: MenuCategory; priceCents: number; active: boolean; inUse: boolean; offerAllowed: boolean }>;
};

export async function getSettingsView(db: Db, restaurantId: string): Promise<SettingsView | null> {
  const ctx = await loadContext(db, restaurantId);
  if (!ctx) return null;
  // Excluídos (exclusão lógica — D197) não aparecem mais no cardápio.
  const items = await db.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurantId), isNull(menuItems.deletedAt))).orderBy(menuItems.position);
  const inUse = new Set(
    [ctx.agora, ctx.recompensa, ...Object.values(ctx.convites)].filter((v): v is NonNullable<typeof v> => !!v).map((v) => v.offer.params.itemId),
  );
  const toIn = (o: Offer | undefined): OfferInput | null => (o ? { kind: o.kind, itemId: o.params.itemId, ...(o.params.pct !== undefined ? { pct: o.params.pct } : {}) } : null);
  const names = Object.fromEntries(ctx.menu.map((m) => [m.id, m.name]));
  return {
    restaurant: {
      aiTone: ctx.restaurant.aiTone,
      aiAbout: ctx.restaurant.aiAbout,
      aiAvoid: ctx.restaurant.aiAvoid,
      aiFeatures: parseAiFeatures(ctx.restaurant.aiFeatures),
      name: ctx.restaurant.name,
      kind: ctx.restaurant.kind,
      isCopy: !!ctx.restaurant.copiedFrom,
      ticketCents: ctx.restaurant.ticketCents,
      marginPct: ctx.restaurant.marginPct,
      tables: ctx.restaurant.tables,
      weeklyCustomers: ctx.restaurant.weeklyCustomers,
      description: ctx.restaurant.description,
      address: ctx.restaurant.address,
      opening: ctx.opening,
    },
    agora: toIn(ctx.agora?.offer),
    recompensa: toIn(ctx.recompensa?.offer),
    slots: ctx.slots.map((s) => {
      const v = ctx.convites[s.id];
      const gain = v ? describeOffer(v.offer, ctx.menu, "convite").gain : undefined;
      return {
        id: s.id,
        label: slotLabel(s),
        days: s.days,
        startMin: s.startMin,
        endMin: s.endMin,
        intensity: s.intensity,
        extraTables: s.extraTables,
        offer: toIn(v?.offer),
        weeklyCap: v?.weeklyCap ?? null,
        inviteText: v?.inviteText ?? "",
        inviteRendered: v?.inviteText ? renderReferences(v.inviteText, { items: names, slots: { [s.id]: slotPhrase(s) }, oferta: gain }) : "",
      };
    }),
    menu: items.map((i) => ({ id: i.id, name: i.name, category: i.category as MenuCategory, priceCents: i.priceCents, active: i.active, inUse: inUse.has(i.id), offerAllowed: i.offerAllowed })),
  };
}

// ---------- Tom da IA do restaurante (D138) ----------
export async function updateTone(db: Db, p: { restaurantId: string; tone: string; now: Date }): Promise<{ ok: true; tone: string | null } | { ok: false; erro: ToneError }> {
  const v = validateTone(p.tone, FORBIDDEN);
  if (!v.ok) return v;
  const [cur] = await db.select({ aiTone: restaurants.aiTone }).from(restaurants).where(eq(restaurants.id, p.restaurantId));
  await db.update(restaurants).set({ aiTone: v.tone }).where(eq(restaurants.id, p.restaurantId));
  await db.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "config:tom", ref: null, suggested: cur?.aiTone ?? null, final: v.tone, at: p.now });
  return { ok: true, tone: v.tone };
}

/**
 * "Ver como fica" (D138; revisão P-I9): regenera o texto do convite de 1 faixa com o tom dado (sem gravar) e devolve
 * antes e depois. Conta no limite do pacote (10/dia). Sem IA: devolve o motivo.
 */
export async function previewTone(
  db: Db,
  p: { restaurantId: string; ownerId: string; slotId: string; tone: string; about?: string; avoid?: string; now: Date; gateway?: AiGateway | null },
): Promise<{ ok: true; before: string; after: string; afterRaw: string } | { ok: false; erro: ToneError | "nao_encontrado" | "sem_ia" | "limite" | "fatos" | "evitar" }> {
  const v = validateTone(p.tone, FORBIDDEN);
  if (!v.ok) return v;
  // S6.3a (revisão técnica I9): a prévia é outra porta de entrada de texto — mesmas validações da gravação.
  const ab = validateAbout(p.about ?? "");
  if (!ab.ok) return { ok: false, erro: "fatos" };
  const av = validateAvoid(p.avoid ?? "");
  if (!av.ok) return { ok: false, erro: "evitar" };
  const ctx = await loadContext(db, p.restaurantId);
  const slot = ctx?.slots.find((s) => s.id === p.slotId);
  const cur = slot ? ctx!.convites[slot.id] : undefined;
  if (!ctx || !slot || !cur) return { ok: false, erro: "nao_encontrado" };
  const [owner] = await db.select({ emailHmac: owners.emailHmac, via: owners.via }).from(owners).where(eq(owners.id, p.ownerId));
  if (owner?.via !== "e2e" && !(await consume(db, `pacote:${p.restaurantId}`, 10, 86_400, p.now)).ok) return { ok: false, erro: "limite" };
  const keyKind = keyKindFor({ emailHmac: owner?.emailHmac ?? null, via: owner?.via ?? null });
  const gw = p.gateway !== undefined ? { gateway: p.gateway, keyKind } : await gatewayFor(db, keyKind, p.now);
  if (!gw.gateway) return { ok: false, erro: "sem_ia" };
  const menu = ctx.menu.filter((m) => !ctx.inactiveItemIds.includes(m.id));
  // A única candidata é a oferta vigente: a IA só reescreve o texto com o tom novo.
  const cands = [{ slotId: slot.id, options: [{ id: "atual", offer: cur.offer, score: 1, unitCostCents: 0, isMax: false, weeklyCap: cur.weeklyCap ?? 1 }] }];
  const prompt = await getActivePrompt(db, "pacote");
  const pp = buildPackagePrompt({ restaurantName: ctx.restaurant.name, cuisine: ctx.restaurant.cuisine, slots: [slot], cands, menu, facts: declaredFacts(ctx.restaurant, [slot], menu), instructions: prompt.instructions, tone: v.tone, owner: { about: ab.about, avoid: av.terms } });
  const res = await runTask(buildPackageTask(pp, MODELS.pacote), pp.system, { text: pp.text }, { gateway: gw.gateway, clock: systemClock, trace: langfuseTracer });
  await recordAiCall(db, { task: "pacote", promptVersion: `${PACKAGE_PROMPT_VERSION}${promptSuffix(prompt, { tone: true, about: !!ab.about, avoid: av.terms.length > 0 })}`, restaurantId: p.restaurantId, result: res, keyKind: gw.keyKind });
  if (res.status !== "ok") return { ok: false, erro: "sem_ia" };
  const after = resolvePackage(pp, res.data)[0]!.textoConvite;
  const rctx = { items: Object.fromEntries(ctx.menu.map((m) => [m.id, m.name])), slots: { [slot.id]: slotPhrase(slot) }, oferta: describeOffer(cur.offer, ctx.menu, "convite").gain };
  return { ok: true, before: renderReferences(cur.inviteText ?? "", rctx), after: renderReferences(after, rctx), afterRaw: after };
}

// ---------- Avisos e automação (S6.1 — D196) ----------
export type NotifyView = {
  settings: NotifySettings;
  to: string | null;
  ownerVia: string | null;
  /** Dia (ISO) em que o dono desligou os e-mails de convite aos clientes — `null` se estão ligados (revisão S4–S6). */
  clientEmailsOffSince: string | null;
};

type EmailsJson = { emails?: { convite?: boolean; reativacao?: boolean } } | null;
const invitesOff = (x: EmailsJson) => x?.emails?.convite === false || x?.emails?.reativacao === false;

/** Última mudança que desligou um e-mail de convite (de ligado para desligado), entre as gravações de "Avisos". */
async function clientEmailsOffSince(db: Db, restaurantId: string, settings: NotifySettings): Promise<string | null> {
  if (settings.emails.convite && settings.emails.reativacao) return null;
  const rows = await db
    .select({ suggested: ownerEdits.suggested, final: ownerEdits.final, at: ownerEdits.at })
    .from(ownerEdits)
    .where(and(eq(ownerEdits.restaurantId, restaurantId), eq(ownerEdits.kind, "config:avisos")))
    .orderBy(desc(ownerEdits.at))
    .limit(50);
  const hit = rows.find((r) => invitesOff(r.final as EmailsJson) && !invitesOff(r.suggested as EmailsJson));
  return hit ? hit.at.toISOString() : null;
}

export async function getNotifyView(db: Db, restaurantId: string): Promise<NotifyView | null> {
  const [r] = await db
    .select({ s: restaurants.notifySettings, enc: owners.emailEnc, hint: owners.emailHint, via: owners.via })
    .from(restaurants)
    .innerJoin(owners, eq(owners.id, restaurants.ownerId))
    .where(eq(restaurants.id, restaurantId));
  if (!r) return null;
  const settings = parseNotifySettings(r.s);
  // D237: o dono vê o próprio e-mail inteiro.
  return { settings, to: r.enc ? (decryptEmail(r.enc) ?? r.hint) : null, ownerVia: r.via, clientEmailsOffSince: await clientEmailsOffSince(db, restaurantId, settings) };
}

/** Grava o objeto inteiro validado, sob lock da linha (o link "parar resumo" e a tela não se atropelam — revisão I7). */
export async function updateNotifySettings(db: Db, p: { restaurantId: string; input: NotifySettings; now: Date }): Promise<{ ok: true; settings: NotifySettings }> {
  return db.transaction(async (tx) => {
    const [cur] = await tx.select({ s: restaurants.notifySettings }).from(restaurants).where(eq(restaurants.id, p.restaurantId)).for("update");
    const before = parseNotifySettings(cur?.s);
    await tx.update(restaurants).set({ notifySettings: p.input }).where(eq(restaurants.id, p.restaurantId));
    await tx.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "config:avisos", ref: null, suggested: before, final: p.input, at: p.now });
    return { ok: true as const, settings: p.input };
  });
}

// ---------- IA do restaurante (S6.3a — D197) ----------

/** Candidatas que sobram (mesma regra do plano da semana) sem os itens de `noOffer`. */
function candidateCount(ctx: NonNullable<Awaited<ReturnType<typeof loadContext>>>, noOffer: readonly string[]): number {
  if (!ctx.slots.length) return 1;
  const menu = ctx.menu.filter((m) => !ctx.inactiveItemIds.includes(m.id));
  const exclude = [ctx.agora?.offer.params.itemId, ctx.recompensa?.offer.params.itemId, ...noOffer].filter((x): x is string => !!x);
  const agoraItem = ctx.agora ? menu.find((m) => m.id === ctx.agora!.offer.params.itemId) : undefined;
  const cands = buildCandidates(ctx.slots, menu, { ticketCents: ctx.restaurant.ticketCents, marginPct: ctx.restaurant.marginPct, exclude, minValueCents: agoraItem?.priceCents });
  return Math.min(...cands.map((c) => c.options.length));
}

/**
 * "Pode entrar em ofertas" (D197): recusa só quando a mudança leva as candidatas dos convites de > 0 para 0, ou
 * quando não sobra nenhum item ativo para o "agora" e a cartela (revisão técnica I5); serializado pelo lock do
 * restaurante. Item numa oferta em vigor continua nela até a próxima troca (aviso).
 */
export async function setItemOfferAllowed(db: Db, p: { restaurantId: string; itemId: string; allowed: boolean; now: Date }): Promise<SettingsResult> {
  return db.transaction(async (tx) => {
    await tx.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.id, p.restaurantId)).for("update");
    const ctx = await loadContext(tx, p.restaurantId);
    if (!ctx || !ctx.menu.some((m) => m.id === p.itemId)) return { ok: false as const, erro: "nao_encontrado" as const };
    const warnings: string[] = [];
    if (!p.allowed) {
      const next = [...new Set([...ctx.noOfferItemIds, p.itemId])];
      const before = candidateCount(ctx, ctx.noOfferItemIds);
      const after = candidateCount(ctx, next);
      if (before > 0 && after === 0) return { ok: false as const, erro: "sem_opcao" as const };
      if (!ctx.menu.some((m) => !ctx.inactiveItemIds.includes(m.id) && !next.includes(m.id))) return { ok: false as const, erro: "sem_opcao" as const };
      if (after === 1) warnings.push("uma_opcao");
      const inUse = [ctx.agora, ctx.recompensa, ...Object.values(ctx.convites)].some((v) => v?.offer.params.itemId === p.itemId);
      if (inUse) warnings.push("em_uso_ate_trocar");
    }
    await tx.update(menuItems).set({ offerAllowed: p.allowed }).where(and(eq(menuItems.id, p.itemId), eq(menuItems.restaurantId, p.restaurantId)));
    await tx.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "config:item_oferta", ref: p.itemId, suggested: null, final: { offerAllowed: p.allowed }, at: p.now });
    return { ok: true as const, warnings };
  });
}

/** "Excluir" (D197, revisão técnica I6): exclusão LÓGICA — some do cardápio, das ofertas e do prompt; códigos e textos antigos continuam. */
export async function deleteMenuItem(db: Db, p: { restaurantId: string; itemId: string; now: Date }): Promise<SettingsResult> {
  return db.transaction(async (tx) => {
    await tx.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.id, p.restaurantId)).for("update");
    const [it] = await tx.select().from(menuItems).where(and(eq(menuItems.id, p.itemId), eq(menuItems.restaurantId, p.restaurantId), isNull(menuItems.deletedAt)));
    if (!it) return { ok: false as const, erro: "nao_encontrado" as const };
    if (await itemInUse(tx, p.restaurantId, p.itemId)) return { ok: false as const, erro: "em_uso" as const };
    await tx.update(menuItems).set({ active: false, offerAllowed: false, deletedAt: p.now }).where(eq(menuItems.id, p.itemId));
    await tx.insert(ownerEdits).values({ restaurantId: p.restaurantId, kind: "config:item_excluido", ref: p.itemId, suggested: { name: it.name }, final: null, at: p.now });
    return { ok: true as const };
  });
}

export type AiProfileError = "fatos" | "evitar";
/** Fatos para a IA + O que evitar + liga/desliga por restaurante (opcionais; vazio = padrão). */
export async function updateAiProfile(
  db: Db,
  p: { restaurantId: string; about: string; avoid: string; features: AiFeatures; now: Date },
): Promise<{ ok: true; warnings: string[] } | { ok: false; erro: AiProfileError; motivo: string }> {
  const a = validateAbout(p.about);
  if (!a.ok) return { ok: false, erro: "fatos", motivo: a.erro };
  const v = validateAvoid(p.avoid);
  if (!v.ok) return { ok: false, erro: "evitar", motivo: v.erro };
  return db.transaction(async (tx) => {
    const [cur] = await tx.select({ about: restaurants.aiAbout, avoid: restaurants.aiAvoid, features: restaurants.aiFeatures }).from(restaurants).where(eq(restaurants.id, p.restaurantId)).for("update");
    if (!cur) return { ok: false as const, erro: "fatos" as const, motivo: "nao_encontrado" };
    await tx.update(restaurants).set({ aiAbout: a.about, aiAvoid: v.avoid, aiFeatures: p.features }).where(eq(restaurants.id, p.restaurantId));
    const edits = [
      cur.about !== a.about ? { kind: "config:sobre", suggested: cur.about, final: a.about } : null,
      cur.avoid !== v.avoid ? { kind: "config:evitar", suggested: cur.avoid, final: v.avoid } : null,
      JSON.stringify(parseAiFeatures(cur.features)) !== JSON.stringify(p.features) ? { kind: "config:ia_recursos", suggested: parseAiFeatures(cur.features), final: p.features } : null,
    ].filter((e): e is NonNullable<typeof e> => !!e);
    if (edits.length) await tx.insert(ownerEdits).values(edits.map((e) => ({ restaurantId: p.restaurantId, ref: null, at: p.now, ...e })));
    // Aviso (não bloqueio): termo a evitar que aparece no nome de um prato do cardápio.
    const items = await tx.select({ name: menuItems.name }).from(menuItems).where(and(eq(menuItems.restaurantId, p.restaurantId), isNull(menuItems.deletedAt)));
    const warnings = v.terms.filter((t) => items.some((i) => findAvoided(i.name, [t]))).map((t) => `no_cardapio:${t}`);
    return { ok: true as const, warnings };
  });
}
