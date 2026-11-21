/** Grava uma rodada da simulação em lote, com `simulation_run_id` (cascata no `clearRun`). */
import { eq, sql } from "drizzle-orm";
import type { Tx } from "@/src/db/executor";
import {
  checkins,
  codes,
  customerContacts,
  customers,
  inviteQuota,
  invites,
  pieceVariants,
  planSendMembers,
  planSends,
  restaurantCustomers,
  scans,
  simulationRuns,
} from "@/src/db/schema";
import { createHash } from "node:crypto";
import { hashDevice, hmacPhone } from "@/src/shared/crypto";
import { daySP } from "@/src/shared/tz";
import type { SimOutput } from "@/src/modules/simulacao/domain/generator";

const BATCH = 1000;

async function insertBatched<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) await insert(rows.slice(i, i + BATCH));
}

/**
 * Id determinístico derivado (cópia da vitrine por conta — D119, revisão T-B1): mesma semente gera os mesmos
 * UUIDs; a cópia remapeia cliente, convite e check-in para não colidir com a vitrine original.
 */
export function derivedId(scope: string, id: string): string {
  const h = createHash("sha256").update(`${scope}:${id}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function persistSimulation(
  tx: Tx,
  p: { restaurantId: string; runId: string; out: SimOutput; planIdBySendKey: Record<string, string>; now: Date; params?: Record<string, unknown>; idScope?: string },
): Promise<void> {
  const { restaurantId, runId, now } = p;
  const out = p.idScope ? remapIds(p.out, p.idScope) : p.out;
  const variants = await tx.select({ id: pieceVariants.id, token: pieceVariants.qrToken }).from(pieceVariants).where(eq(pieceVariants.restaurantId, restaurantId));
  const variantId = (token: string | null) => (token ? (variants.find((v) => v.token === token)?.id ?? null) : null);

  await insertBatched(out.customers, (chunk) => tx.insert(customers).values(chunk.map((c) => ({ id: c.id, simulationRunId: runId, createdAt: c.firstCheckinAt ?? now }))));
  await insertBatched(out.customers, (chunk) =>
    // HMAC com o prefixo da rodada: telefone simulado nunca colide com o de uma pessoa (nem entre rodadas).
    tx.insert(customerContacts).values(chunk.map((c) => ({ customerId: c.id, phoneHmac: hmacPhone(`sim:${runId}:${c.phoneDigits}`), phoneLast4: c.phoneDigits.slice(-4), name: c.name }))),
  );
  const firstDraw = new Map<string, Date>();
  for (const inv of out.invites) if (!firstDraw.has(inv.customerId)) firstDraw.set(inv.customerId, inv.issuedAt);
  await insertBatched(out.customers, (chunk) =>
    tx.insert(restaurantCustomers).values(
      chunk.map((c) => ({
        restaurantId,
        customerId: c.id,
        firstCheckinAt: c.firstCheckinAt,
        lastCheckinDay: c.state.lastCheckinDay,
        firstVisitCodeIssued: c.state.firstVisitCodeIssued,
        optWhatsapp: c.optIn,
        optApp: c.optIn,
        optPush: c.optIn,
        optEmail: c.optIn,
        arm: c.state.arm,
        armAssignedAt: firstDraw.get(c.id) ?? null,
        originVariantId: variantId(c.variant),
        cardStartedDay: c.state.card?.startedDay ?? null,
        cardStamps: c.state.card?.stamps ?? 0,
        cardLastDay: c.state.card?.lastDay ?? null,
        cardCompletedDay: c.state.card?.completedDay ?? null,
      })),
    ),
  );

  const sendIds: Record<string, string> = {};
  for (const s of out.sends) {
    const planId = p.planIdBySendKey[s.key];
    if (!planId) continue;
    const [row] = await tx.insert(planSends).values({ restaurantId, planId, channel: "crm_simulado", sentAt: s.at, recipients: s.members.length, simulationRunId: runId }).returning({ id: planSends.id });
    sendIds[s.key] = row!.id;
  }

  await insertBatched(out.invites, (chunk) =>
    tx.insert(invites).values(
      chunk.map((i) => ({
        id: i.id,
        restaurantId,
        customerId: i.customerId,
        benefitVersionId: i.versionId,
        slotId: i.slot.id,
        slotSnapshot: i.slot,
        arm: i.arm,
        status: i.status,
        origin: i.origin,
        issuedAt: i.issuedAt,
        issuedDay: i.issuedDay,
        weekKey: i.weekKey,
        expiresAt: i.expiresAt,
        usedAt: i.usedAt,
        planSendId: i.sendKey ? (sendIds[i.sendKey] ?? null) : null,
        simulationRunId: runId,
      })),
    ),
  );
  for (const s of out.sends) {
    if (!sendIds[s.key] || s.members.length === 0) continue;
    await insertBatched(s.members, (chunk) => tx.insert(planSendMembers).values(chunk.map((m) => ({ sendId: sendIds[s.key]!, customerId: m.customerId, inviteId: m.inviteId, arm: m.arm }))));
  }

  await insertBatched(out.checkins, (chunk) =>
    tx.insert(checkins).values(
      chunk.map((c) => ({
        id: c.id,
        restaurantId,
        customerId: c.customerId,
        at: c.at,
        daySp: c.day,
        turn: c.turn,
        gpsStatus: "perto",
        variantId: variantId(c.variant),
        idempotencyKey: `sim:${runId}:${c.id}`,
        result: { outcome: c.outcome },
        simulationRunId: runId,
      })),
    ),
  );
  await insertBatched(out.codes, (chunk) =>
    tx.insert(codes).values(
      chunk.map((c) => {
        const validated = c.validatedAt !== null && c.validatedAt.getTime() <= now.getTime();
        return {
          restaurantId,
          customerId: c.customerId,
          type: c.type,
          code: c.code,
          itemId: c.itemId,
          benefitVersionId: c.versionId,
          inviteId: c.inviteId,
          checkinId: c.checkinId,
          validDay: c.validDay,
          status: validated ? "validado" : "emitido",
          issuedAt: c.issuedAt,
          validatedAt: validated ? c.validatedAt : null,
          simulationRunId: runId,
        };
      }),
    ),
  );
  await insertBatched(out.scans, (chunk) =>
    tx.insert(scans).values(chunk.map((s) => ({ restaurantId, variantId: variantId(s.variant), deviceHash: hashDevice(s.device), at: s.at, daySp: daySP(s.at), simulationRunId: runId }))),
  );
  for (const q of out.quotas) {
    await tx
      .insert(inviteQuota)
      .values({ restaurantId, slotId: q.slotId, weekKey: q.weekKey, cap: q.cap, used: q.used })
      .onConflictDoUpdate({ target: [inviteQuota.restaurantId, inviteQuota.slotId, inviteQuota.weekKey], set: { cap: q.cap, used: sql`${inviteQuota.used} + ${q.used}` } });
  }
  await tx.update(simulationRuns).set({ params: { ...(p.params ?? {}), customers: out.customers.length, checkins: out.checkins.length } }).where(eq(simulationRuns.id, runId));
}

function remapIds(out: SimOutput, scope: string): SimOutput {
  const m = (id: string) => derivedId(scope, id);
  const mo = (id: string | null) => (id ? m(id) : null);
  return {
    ...out,
    customers: out.customers.map((c) => ({ ...c, id: m(c.id) })),
    invites: out.invites.map((i) => ({ ...i, id: m(i.id), customerId: m(i.customerId) })),
    checkins: out.checkins.map((c) => ({ ...c, id: m(c.id), customerId: m(c.customerId) })),
    codes: out.codes.map((c) => ({ ...c, customerId: m(c.customerId), inviteId: mo(c.inviteId), checkinId: m(c.checkinId) })),
    sends: out.sends.map((s) => ({ ...s, members: s.members.map((x) => ({ ...x, customerId: m(x.customerId), inviteId: mo(x.inviteId) })) })),
  };
}

/** Remove exatamente a rodada (cascata) e reconta o teto pelos convites reais que sobraram (T-I4). */
export async function clearRun(tx: Tx, runId: string): Promise<void> {
  const [run] = await tx.select({ restaurantId: simulationRuns.restaurantId }).from(simulationRuns).where(eq(simulationRuns.id, runId)).limit(1);
  if (!run) return;
  await tx.delete(simulationRuns).where(eq(simulationRuns.id, runId));
  await tx.execute(sql`
    update invite_quota q set used = (
      select count(*) from invites i
      where i.restaurant_id = q.restaurant_id and i.slot_id = q.slot_id and i.week_key = q.week_key and i.arm = 'convidavel'
    ) where q.restaurant_id = ${run.restaurantId}`);
}
