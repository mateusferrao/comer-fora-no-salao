/**
 * Valor ao dono em R$ e metas por faixa (S5.1, D179, D185). Como a métrica principal, inclui o histórico gerado
 * (com o selo do restaurante de exemplo — D162). Por restaurante; o chamador garante que é o da sessão. Sem PII.
 */
import { and, eq, sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { inviteQuota } from "@/src/db/schema";
import { unitCost } from "@/src/modules/beneficios/domain/offers";
import { loadContext, loadVersion, type RestaurantContext } from "@/src/modules/salao/application/context";
import { addDaysSP, weekdayOfDay, weekKeyOfDay } from "@/src/shared/week";
import { slotGoals, type EarlyValue, type SlotGoal } from "../domain/value";

type Row = Record<string, unknown>;
const rows = async (ex: Executor, q: ReturnType<typeof sql>): Promise<Row[]> => ((await ex.execute(q)) as unknown as { rows: Row[] }).rows;

/** Convites usados (códigos de convite validados pelo garçom) desde o 1º convite, e o custo deles (versão da emissão). */
export async function getEarlyValue(ex: Executor, restaurantId: string, ctx?: RestaurantContext | null): Promise<EarlyValue> {
  const c = ctx ?? (await loadContext(ex, restaurantId));
  if (!c) return { usados: 0, custoCents: 0 };
  const byVersion = await rows(
    ex,
    sql`select benefit_version_id, count(*)::int n from codes where restaurant_id = ${restaurantId} and type = 'convite' and status = 'validado' group by benefit_version_id`,
  );
  let usados = 0;
  let custoCents = 0;
  for (const r of byVersion) {
    const n = Number(r.n);
    usados += n;
    const v = r.benefit_version_id ? await loadVersion(ex, String(r.benefit_version_id)) : null;
    if (v) custoCents += n * unitCost(v.offer, c.menu, c.restaurant.marginPct ?? undefined).cents;
  }
  return { usados, custoCents };
}

/**
 * Metas da semana (seg–dom em SP) que contém `day`, por faixa ativa. `usados` = convites validados na semana (pelo dia
 * de validação); `emitidos`/`teto` = cota da semana; sem cota ainda, o teto da regra vigente da faixa.
 * Recebe um dia (não a chave da semana) para a S6 pedir a semana anterior com um dia dela [C].
 */
export async function getSlotGoals(ex: Executor, restaurantId: string, day: string, ctx?: RestaurantContext | null): Promise<SlotGoal[]> {
  const c = ctx ?? (await loadContext(ex, restaurantId));
  if (!c || !c.slots.length) return [];
  const monday = addDaysSP(day, -((weekdayOfDay(day) + 6) % 7));
  const sunday = addDaysSP(monday, 6);
  const used = await rows(
    ex,
    sql`select i.slot_id, count(*)::int n from codes k join invites i on i.id = k.invite_id
        where k.restaurant_id = ${restaurantId} and k.type = 'convite' and k.status = 'validado' and k.valid_day between ${monday} and ${sunday}
        group by i.slot_id`,
  );
  const quota = await ex
    .select({ slotId: inviteQuota.slotId, used: inviteQuota.used, cap: inviteQuota.cap })
    .from(inviteQuota)
    .where(and(eq(inviteQuota.restaurantId, restaurantId), eq(inviteQuota.weekKey, weekKeyOfDay(day))));
  const capFallback = new Map<string, number>();
  for (const s of c.slots) {
    const cap = c.convites[s.id]?.weeklyCap;
    if (cap != null) capFallback.set(s.id, cap);
  }
  return slotGoals(
    c.slots,
    new Map(used.map((u) => [String(u.slot_id), Number(u.n)])),
    new Map(quota.map((q) => [q.slotId, { used: q.used, cap: q.cap }])),
    capFallback,
  );
}
