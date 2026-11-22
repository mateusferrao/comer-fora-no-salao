/**
 * Check-in em transação (planejamento S1 §6.4 + revisão T-B1/T-I4/T-I6):
 * idempotência conferida DEPOIS do lock do cliente; teto recontado sob lock; grupo gravado uma vez.
 */
import { queueInviteMessages } from "./queue-messages";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Executor, Tx } from "@/src/db/executor";
import { checkins, codes, invites, restaurantCustomers } from "@/src/db/schema";
import type { Clock } from "@/src/shared/clock";
import { daySP } from "@/src/shared/tz";
import { weekKeySP } from "@/src/shared/week";
import { STAMP_CARD_DEFAULTS, type StampCardState } from "@/src/modules/beneficios/domain/stamp-card";
import type { CodeType } from "@/src/modules/beneficios/domain/codes";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { decideCheckin, type ActiveInvite, type CustomerState } from "@/src/modules/salao/domain/decide-checkin";
import { decideInvite, type Arm, type InviteDecision } from "@/src/modules/salao/domain/experiment";
import type { GpsStatus } from "@/src/modules/salao/domain/geo";
import { inviteSlots, loadContext, loadVersion, remainingBySlot, type RestaurantContext, type VersionedOffer } from "./context";
import { expireInvites, insertInvite, issueCode, reserveQuota } from "./persistence";
import { renderReferences } from "@/src/modules/textos/domain/references";
import { slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import { offerView, sanitizeCheckinView, type CheckinView, type CodeView, type InviteView } from "./views";
import { nextValidWindow } from "../domain/invite-window";
import { inviteExtra } from "../domain/invite-text";
import { agendaPath } from "./agenda";

export type DoCheckinInput = {
  restaurantId: string;
  customerId: string;
  gpsStatus: GpsStatus;
  variantId: string | null;
  idempotencyKey: string;
  clock: Clock;
  randInt: (n: number) => number;
};

type ActiveInviteRow = ActiveInvite & { id: string; benefitVersionId: string | null };

async function loadActiveInvite(tx: Tx, restaurantId: string, customerId: string): Promise<ActiveInviteRow | null> {
  const [row] = await tx
    .select()
    .from(invites)
    .where(and(eq(invites.restaurantId, restaurantId), eq(invites.customerId, customerId), inArray(invites.status, ["ativo", "suprimido"])))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    benefitVersionId: row.benefitVersionId,
    slot: row.slotSnapshot as Slot,
    arm: row.arm as Arm,
    status: row.status as "ativo" | "suprimido",
    issuedDay: row.issuedDay,
    expiresAt: row.expiresAt,
    anyTimeDay: row.testValidDay,
  };
}

async function storedResult(ex: Executor, p: DoCheckinInput): Promise<CheckinView | null> {
  const [row] = await ex
    .select({ result: checkins.result })
    .from(checkins)
    .where(and(eq(checkins.idempotencyKey, p.idempotencyKey), eq(checkins.customerId, p.customerId), eq(checkins.restaurantId, p.restaurantId)))
    .limit(1);
  return row ? (row.result as CheckinView) : null;
}

function inviteViewOf(
  inv: Pick<ActiveInvite, "slot" | "issuedDay" | "expiresAt" | "anyTimeDay">,
  ctx: RestaurantContext,
  state: InviteView["state"],
  version: VersionedOffer | null,
  today: string,
  meta: { inviteId: string | null; now: Date },
): InviteView {
  const offer = offerView(version?.offer, ctx.menu, "convite");
  // S4 (D153): liberado fora da faixa hoje pelas Ferramentas do avaliador (qualquer restaurante; antes, só o de teste).
  const liberatedToday = !!inv.anyTimeDay && inv.anyTimeDay === today;
  // S5.2: agenda e "vale hoje" pela próxima janela em que o código pode nascer (nunca o dia da emissão).
  const win = nextValidWindow({ slot: inv.slot, issuedDay: inv.issuedDay, expiresAt: inv.expiresAt, now: meta.now });
  return {
    state,
    days: inv.slot.days,
    startMin: inv.slot.startMin,
    endMin: inv.slot.endMin,
    untilDay: daySP(inv.expiresAt),
    offer,
    // S9: sem repetir a 1ª linha do cartão ("Volte {quando} e ganhe {oferta}"); fica só o que o dono acrescentou.
    message: inviteExtra(inviteMessage(version, inv.slot, ctx, offer?.gain), offer?.gain),
    liberatedToday,
    agendaUrl: win && meta.inviteId ? agendaPath(meta.inviteId) : null,
    validToday: (win?.day === today) || liberatedToday,
    firstDay: win?.day ?? null,
  };
}

/** Texto do convite renderizado com a faixa CONGELADA do convite (D218) e a oferta da versão da emissão. */
export function inviteMessage(version: VersionedOffer | null, slot: ActiveInvite["slot"], ctx: RestaurantContext, gain: string | undefined): string | null {
  if (!version?.inviteText) return null;
  const items = Object.fromEntries(ctx.menu.map((m) => [m.id, m.name]));
  const text = renderReferences(version.inviteText, { items, slots: { [slot.id]: slotPhrase(slot) }, oferta: gain }).trim();
  return text || null;
}

/** Códigos do dia ainda não validados + convite real ativo (P-B1: recarregar não perde nada). */
export async function todayView(ex: Executor, ctx: RestaurantContext, customerId: string, now: Date): Promise<Pick<CheckinView, "codes" | "invite">> {
  const today = daySP(now);
  const rows = await ex
    .select({ type: codes.type, code: codes.code, itemId: codes.itemId, inviteId: codes.inviteId, benefitVersionId: codes.benefitVersionId })
    .from(codes)
    .where(and(eq(codes.restaurantId, ctx.restaurant.id), eq(codes.customerId, customerId), eq(codes.validDay, today), eq(codes.status, "emitido")));
  const codeViews: CodeView[] = [];
  for (const r of rows) codeViews.push(codeView(r.type as CodeType, r.code, ctx, r.itemId, r.type === "convite" ? await loadVersion(ex, r.benefitVersionId) : null));
  const [inv] = await ex
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.restaurantId, ctx.restaurant.id),
        eq(invites.customerId, customerId),
        eq(invites.status, "ativo"),
        eq(invites.arm, "convidavel"),
        sql`${invites.expiresAt} > ${now.toISOString()}`,
      ),
    )
    .limit(1);
  let invite: InviteView | null = null;
  if (inv) {
    const slot = inv.slotSnapshot as Slot;
    const usingToday = rows.some((r) => r.type === "convite");
    invite = inviteViewOf({ slot, issuedDay: inv.issuedDay, expiresAt: inv.expiresAt, anyTimeDay: inv.testValidDay }, ctx, usingToday ? "usar_hoje" : inv.issuedDay === today ? "novo" : "lembrete", await loadVersion(ex, inv.benefitVersionId), today, { inviteId: inv.id, now });
  }
  return { codes: codeViews, invite };
}

function codeView(type: CodeType, code: string, ctx: RestaurantContext, itemId: string | null, inviteVersion: VersionedOffer | null = null): CodeView {
  const role = type === "primeira_visita" ? "agora" : type;
  const source = type === "primeira_visita" ? ctx.agora : type === "recompensa" ? ctx.recompensa : inviteVersion;
  // S9: o cupom do cliente usa o mesmo nome que o garçom vê ("Panna cotta grátis"), não o tipo ("Doce grátis").
  const titleFrom = source ? offerView(source.offer, ctx.menu, role)?.gain : undefined;
  const item = ctx.menu.find((i) => i.id === itemId)?.name ?? "";
  const titles: Record<CodeType, string> = { primeira_visita: "Benefício de 1ª visita", convite: "Seu convite", recompensa: "Recompensa da cartela" };
  return { type, code, title: titleFrom ?? titles[type], itemName: item };
}

export async function doCheckin(db: Db, p: DoCheckinInput): Promise<CheckinView> {
  const early = await storedResult(db, p);
  if (early) return early;
  if (!(await loadContext(db, p.restaurantId))) throw new Error("restaurante não encontrado");

  return db.transaction(async (tx) => {
    // FOR SHARE no restaurante (revisão técnica S3): serializa com a aprovação do plano (FOR UPDATE, mesma ordem de
    // locks), sem bloquear check-ins entre si; o contexto é lido depois, já com as versões que a aprovação criou.
    await tx.execute(sql`select id from restaurants where id = ${p.restaurantId} for share`);
    const ctx = (await loadContext(tx, p.restaurantId))!;
    const now = p.clock.now();
    await tx.insert(restaurantCustomers).values({ restaurantId: p.restaurantId, customerId: p.customerId }).onConflictDoNothing();
    const [rc] = await tx
      .select()
      .from(restaurantCustomers)
      .where(and(eq(restaurantCustomers.restaurantId, p.restaurantId), eq(restaurantCustomers.customerId, p.customerId)))
      .for("update");
    // Clique duplo: o 2º pedido espera o lock e encontra o resultado do 1º (T-B1).
    const replay = await storedResult(tx, p);
    if (replay) return replay;

    await expireInvites(tx, p.restaurantId, p.customerId, now);
    const active = await loadActiveInvite(tx, p.restaurantId, p.customerId);
    const activeVersion = active ? await loadVersion(tx, active.benefitVersionId) : null;
    const weekKey = weekKeySP(now);
    const slots = inviteSlots(ctx);
    const remaining = await remainingBySlot(tx, ctx, weekKey);

    const card: StampCardState | null = rc!.cardStartedDay
      ? { startedDay: rc!.cardStartedDay, stamps: rc!.cardStamps, lastDay: rc!.cardLastDay, completedDay: rc!.cardCompletedDay }
      : null;
    const state: CustomerState = {
      lastCheckinDay: rc!.lastCheckinDay,
      firstVisitCodeIssued: rc!.firstVisitCodeIssued,
      card,
      activeInvite: active,
      arm: (rc!.arm as Arm | null) ?? null,
    };
    const baseInput = { at: now, customerId: p.customerId, restaurantId: p.restaurantId, customer: state, stampConfig: STAMP_CARD_DEFAULTS };
    const decision = decideCheckin({ ...baseInput, rule: { active: slots.length > 0, slots, remaining } });

    if (decision.outcome === "ja_fez_checkin_hoje") {
      const t = await todayView(tx, ctx, p.customerId, now);
      return sanitizeCheckinView({ outcome: decision.outcome, stamps: card?.stamps ?? 0, required: STAMP_CARD_DEFAULTS.required, ...t, firstVisitAlreadyUsed: false });
    }

    // Convite real: reserva a vaga sob lock; se a faixa encheu nesse meio-tempo, tenta a próxima.
    let invite: InviteDecision | null = decision.invite;
    const rem = { ...remaining };
    while (invite && invite.kind === "real") {
      const cap = ctx.convites[invite.slotId]!.weeklyCap ?? 0;
      if (await reserveQuota(tx, { restaurantId: p.restaurantId, slotId: invite.slotId, weekKey, cap })) break;
      rem[invite.slotId] = 0;
      invite = decideInvite({ customerId: p.customerId, restaurantId: p.restaurantId, ruleActive: true, hasActiveInvite: false, slots, remaining: rem, arm: invite.arm }, now);
    }

    const issued = invite && (invite.kind === "real" || invite.kind === "fantasma") ? invite : null;
    if (issued && state.arm === null) {
      // Grava o grupo uma única vez (WHERE arm IS NULL).
      await tx
        .update(restaurantCustomers)
        .set({ arm: issued.arm, armAssignedAt: now })
        .where(and(eq(restaurantCustomers.restaurantId, p.restaurantId), eq(restaurantCustomers.customerId, p.customerId), sql`${restaurantCustomers.arm} is null`));
    }

    const checkinId = crypto.randomUUID();
    let issuedId: string | null = null;
    if (issued) {
      issuedId = await insertInvite(tx, {
        restaurantId: p.restaurantId,
        customerId: p.customerId,
        slot: issued.slot,
        arm: issued.arm,
        benefitVersionId: ctx.convites[issued.slotId]?.versionId ?? null,
        origin: "mesa",
        at: now,
        expiresAt: issued.expiresAt,
      });
      // S4.4 (D155): convite REAL vira mensagem no app (e e-mail depois do commit, pela rota); o fantasma, nada.
      if (issuedId && issued.kind === "real") await queueInviteMessages(tx, { inviteIds: [issuedId], kind: "convite_mesa", now });
    }

    const codeViews: CodeView[] = [];
    const pending: Array<() => Promise<void>> = [];
    // Sem benefício configurado (agora/recompensa), não há código a emitir.
    const codesToIssue = decision.codes.filter((t) => (t === "primeira_visita" ? ctx.agora : t === "recompensa" ? ctx.recompensa : activeVersion) !== null);
    for (const type of codesToIssue) {
      const src = type === "primeira_visita" ? ctx.agora : type === "recompensa" ? ctx.recompensa : null;
      const inviteRow = type === "convite" ? active : null;
      const itemId = type === "convite" ? (activeVersion?.offer.params.itemId ?? null) : (src?.offer.params.itemId ?? null);
      pending.push(async () => {
        const code = await issueCode(tx, {
          restaurantId: p.restaurantId,
          customerId: p.customerId,
          type,
          itemId: ctx.menu.some((i) => i.id === itemId) ? itemId : null,
          benefitVersionId: type === "convite" ? (inviteRow?.benefitVersionId ?? null) : (src?.versionId ?? null),
          inviteId: inviteRow?.id ?? null,
          checkinId,
          at: now,
          randInt: p.randInt,
        });
        codeViews.push(codeView(type, code, ctx, itemId, type === "convite" ? activeVersion : null));
      });
    }

    let inviteView: InviteView | null = null;
    if (issued && issued.kind === "real") inviteView = inviteViewOf({ slot: issued.slot, issuedDay: decision.day, expiresAt: issued.expiresAt }, ctx, "novo", ctx.convites[issued.slotId] ?? null, decision.day, { inviteId: issuedId, now });
    else if (decision.inviteForCode) inviteView = inviteViewOf(decision.inviteForCode, ctx, "usar_hoje", activeVersion, decision.day, { inviteId: active?.id ?? null, now });
    else if (decision.reminder) inviteView = inviteViewOf(decision.reminder, ctx, "lembrete", activeVersion, decision.day, { inviteId: active?.id ?? null, now });
    // S4 (D152, D172): o motivo de não haver 2º card (grupo de controle ou teto) não aparece mais ao cliente;
    // o dono vê o grupo de controle em "Últimos check-ins de hoje".

    const result = (): CheckinView =>
      sanitizeCheckinView({
        outcome: decision.outcome,
        stamps: decision.stamp?.stamps ?? 0,
        required: STAMP_CARD_DEFAULTS.required,
        codes: codeViews,
        invite: inviteView,
        firstVisitAlreadyUsed: decision.firstVisitAlreadyUsed,
      });

    const inserted = await tx
      .insert(checkins)
      .values({
        id: checkinId,
        restaurantId: p.restaurantId,
        customerId: p.customerId,
        at: now,
        daySp: decision.day,
        turn: decision.turn,
        gpsStatus: p.gpsStatus,
        variantId: p.variantId,
        benefitVersionId: ctx.agora?.versionId ?? null,
        idempotencyKey: p.idempotencyKey,
        result: {},
      })
      .onConflictDoNothing()
      .returning({ id: checkins.id });
    if (inserted.length === 0) throw new Error("check-in em conflito");

    for (const run of pending) await run();
    const view = result();
    await tx.update(checkins).set({ result: view }).where(eq(checkins.id, checkinId));

    await tx
      .update(restaurantCustomers)
      .set({
        lastCheckinDay: decision.day,
        firstCheckinAt: rc!.firstCheckinAt ?? now,
        firstVisitCodeIssued: rc!.firstVisitCodeIssued || codesToIssue.includes("primeira_visita"),
        originVariantId: rc!.firstCheckinAt ? rc!.originVariantId : p.variantId, // A15: a peça de origem é a do 1º check-in
        cardStartedDay: decision.card?.startedDay ?? null,
        cardStamps: decision.card?.stamps ?? 0,
        cardLastDay: decision.card?.lastDay ?? null,
        cardCompletedDay: decision.card?.completedDay ?? null,
      })
      .where(and(eq(restaurantCustomers.restaurantId, p.restaurantId), eq(restaurantCustomers.customerId, p.customerId)));
    return view;
  });
}
