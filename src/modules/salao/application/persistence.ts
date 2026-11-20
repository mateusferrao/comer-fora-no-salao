/**
 * Operações de gravação reutilizáveis (T-I6): check-in, reativação (S3) e "antecipar convite" (S3) usam as mesmas.
 * Todas recebem a transação e o relógio; nada usa `now()` do SQL.
 */
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import type { Tx } from "@/src/db/executor";
import { codes, inviteQuota, invites } from "@/src/db/schema";
import { generateCode, type CodeType } from "@/src/modules/beneficios/domain/codes";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import type { Arm } from "@/src/modules/salao/domain/experiment";
import { daySP } from "@/src/shared/tz";
import { weekKeySP } from "@/src/shared/week";

/** Marca como vencidos os convites (reais e fantasmas) que passaram da validade. */
export async function expireInvites(tx: Tx, restaurantId: string, customerId: string, now: Date): Promise<void> {
  await tx
    .update(invites)
    .set({ status: "expirado" })
    .where(
      and(
        eq(invites.restaurantId, restaurantId),
        eq(invites.customerId, customerId),
        inArray(invites.status, ["ativo", "suprimido"]),
        lte(invites.expiresAt, now),
      ),
    );
}

/**
 * Reserva atômica de 1 vaga real na faixa/semana: trava a linha do teto e reconta os convites reais.
 * Devolve false se não houver vaga.
 */
export async function reserveQuota(tx: Tx, p: { restaurantId: string; slotId: string; weekKey: string; cap: number }): Promise<boolean> {
  await tx
    .insert(inviteQuota)
    .values({ restaurantId: p.restaurantId, slotId: p.slotId, weekKey: p.weekKey, cap: p.cap, used: 0 })
    .onConflictDoUpdate({ target: [inviteQuota.restaurantId, inviteQuota.slotId, inviteQuota.weekKey], set: { cap: p.cap } });
  await tx
    .select({ used: inviteQuota.used })
    .from(inviteQuota)
    .where(and(eq(inviteQuota.restaurantId, p.restaurantId), eq(inviteQuota.slotId, p.slotId), eq(inviteQuota.weekKey, p.weekKey)))
    .for("update");
  const [{ n }] = (await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(invites)
    .where(and(eq(invites.restaurantId, p.restaurantId), eq(invites.slotId, p.slotId), eq(invites.weekKey, p.weekKey), eq(invites.arm, "convidavel")))) as [
    { n: number },
  ];
  if (n >= p.cap) return false;
  await tx
    .update(inviteQuota)
    .set({ used: n + 1 })
    .where(and(eq(inviteQuota.restaurantId, p.restaurantId), eq(inviteQuota.slotId, p.slotId), eq(inviteQuota.weekKey, p.weekKey)));
  return true;
}

export async function insertInvite(
  tx: Tx,
  p: {
    restaurantId: string;
    customerId: string;
    slot: Slot;
    arm: Arm;
    benefitVersionId: string | null;
    origin: "mesa" | "reativacao";
    at: Date;
    expiresAt: Date;
    planSendId?: string | null;
    simulationRunId?: string | null;
  },
): Promise<string> {
  const [row] = await tx
    .insert(invites)
    .values({
      restaurantId: p.restaurantId,
      customerId: p.customerId,
      benefitVersionId: p.benefitVersionId,
      slotId: p.slot.id,
      slotSnapshot: p.slot,
      arm: p.arm,
      status: p.arm === "holdout" ? "suprimido" : "ativo",
      origin: p.origin,
      issuedAt: p.at,
      issuedDay: daySP(p.at),
      weekKey: weekKeySP(p.at),
      expiresAt: p.expiresAt,
      planSendId: p.planSendId ?? null,
      simulationRunId: p.simulationRunId ?? null,
    })
    .returning({ id: invites.id });
  return row!.id;
}

/** Emite um código único no restaurante (nova tentativa em colisão, até 5). */
export async function issueCode(
  tx: Tx,
  p: {
    restaurantId: string;
    customerId: string;
    type: CodeType;
    itemId: string | null;
    benefitVersionId: string | null;
    inviteId: string | null;
    checkinId: string | null;
    at: Date;
    randInt: (n: number) => number;
  },
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(p.randInt);
    const rows = await tx
      .insert(codes)
      .values({
        restaurantId: p.restaurantId,
        customerId: p.customerId,
        type: p.type,
        code,
        itemId: p.itemId,
        benefitVersionId: p.benefitVersionId,
        inviteId: p.inviteId,
        checkinId: p.checkinId,
        validDay: daySP(p.at),
        issuedAt: p.at,
      })
      .onConflictDoNothing({ target: [codes.restaurantId, codes.code] })
      .returning({ code: codes.code });
    if (rows.length > 0) return code;
  }
  throw new Error("não foi possível gerar um código único");
}
