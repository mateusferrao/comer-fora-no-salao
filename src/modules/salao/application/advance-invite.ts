/**
 * "Avançar 1 dia" (D153; antes D140/D141, "antecipar" só no restaurante de teste) — usado pelas Ferramentas do
 * avaliador nos Bastidores, em qualquer restaurante do dono, só com clientes reais (nunca o histórico gerado).
 * O código do convite nasce numa volta em OUTRO dia e DENTRO da faixa. Então:
 * - recua 1 dia o convite e a visita de hoje (a regra "1 check-in por dia" barraria a volta);
 * - se agora estiver fora da faixa, libera o convite fora do horário só hoje (`test_valid_day`).
 * Mantém o `week_key` (teto e coorte não mudam de semana). Lock na mesma ordem do check-in (cliente → convite).
 */
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { checkins, customers, invites, restaurantCustomers } from "@/src/db/schema";
import { isInSlot, type Slot } from "@/src/modules/beneficios/domain/slots";
import { daySP } from "@/src/shared/tz";
import { addDaysSP } from "@/src/shared/week";

export type AdvanceResult = { ok: true; testValidToday: boolean } | { ok: false; erro: "nao_encontrado" | "historico" | "nao_se_aplica" };
const DAY_MS = 86_400_000;

export async function advanceInvite(db: Db, p: { customerId: string; inviteId: string; now: Date }): Promise<AdvanceResult> {
  return db.transaction(async (tx) => {
    const [head] = await tx.select({ restaurantId: invites.restaurantId, customerId: invites.customerId }).from(invites).where(eq(invites.id, p.inviteId)).limit(1);
    if (!head || head.customerId !== p.customerId) return { ok: false as const, erro: "nao_encontrado" as const };
    const [cu] = await tx.select({ run: customers.simulationRunId }).from(customers).where(eq(customers.id, p.customerId));
    if (!cu || cu.run) return { ok: false as const, erro: "historico" as const };
    const [rc] = await tx
      .select()
      .from(restaurantCustomers)
      .where(and(eq(restaurantCustomers.restaurantId, head.restaurantId), eq(restaurantCustomers.customerId, p.customerId)))
      .for("update");
    const [inv] = await tx.select().from(invites).where(eq(invites.id, p.inviteId)).for("update");
    if (!rc || !inv || inv.status !== "ativo" || inv.arm !== "convidavel" || inv.expiresAt <= p.now) return { ok: false as const, erro: "nao_se_aplica" as const };
    const today = daySP(p.now);
    const yesterday = addDaysSP(today, -1);
    const outside = !isInSlot(inv.slotSnapshot as Slot, p.now);
    // Já antecipado (e ainda sem volta hoje): idempotente. Só com o marcador: um convite que nasceu ontem de
    // verdade não é "antecipado" e não ganha liberação fora da faixa (revisão S3 #34).
    if (inv.advancedAt && inv.issuedDay === yesterday && rc.lastCheckinDay !== today) {
      if (outside && inv.testValidDay !== today) await tx.update(invites).set({ testValidDay: today }).where(eq(invites.id, inv.id));
      return { ok: true as const, testValidToday: outside || inv.testValidDay === today };
    }
    if (inv.issuedDay !== today) return { ok: false as const, erro: "nao_se_aplica" as const };
    // Check-in ontem: recuar a visita de hoje bateria no "1 check-in por dia" (revisão T-I1).
    const [ontem] = await tx.select({ id: checkins.id }).from(checkins).where(and(eq(checkins.restaurantId, head.restaurantId), eq(checkins.customerId, p.customerId), eq(checkins.daySp, yesterday))).limit(1);
    if (ontem) return { ok: false as const, erro: "nao_se_aplica" as const };

    await tx
      .update(invites)
      .set({ issuedAt: new Date(inv.issuedAt.getTime() - DAY_MS), issuedDay: yesterday, testValidDay: outside ? today : null, advancedAt: p.now })
      .where(eq(invites.id, inv.id));
    await tx
      .update(checkins)
      .set({ at: sql`${checkins.at} - interval '1 day'`, daySp: yesterday })
      .where(and(eq(checkins.restaurantId, head.restaurantId), eq(checkins.customerId, p.customerId), eq(checkins.daySp, today)));
    await tx
      .update(restaurantCustomers)
      .set({
        lastCheckinDay: rc.lastCheckinDay === today ? yesterday : rc.lastCheckinDay,
        cardLastDay: rc.cardLastDay === today ? yesterday : rc.cardLastDay,
        cardStartedDay: rc.cardStartedDay === today ? yesterday : rc.cardStartedDay,
        firstCheckinAt: rc.firstCheckinAt && daySP(rc.firstCheckinAt) === today ? new Date(rc.firstCheckinAt.getTime() - DAY_MS) : rc.firstCheckinAt,
      })
      .where(and(eq(restaurantCustomers.restaurantId, head.restaurantId), eq(restaurantCustomers.customerId, p.customerId)));
    return { ok: true as const, testValidToday: outside };
  });
}
