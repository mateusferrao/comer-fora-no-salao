/**
 * Tabela do A/B (flag `ab`) e alertas de operação (insight 4, flag `insight_operacao`) — só leitura.
 */
import { sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { loadContext } from "@/src/modules/salao/application/context";
import { slotAliases, slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import { daySP } from "@/src/shared/tz";
import { addDaysSP, weekKeySP } from "@/src/shared/week";
import { abTable, alertText, operationAlerts, type AbRow, type TurnCodes, type VariantStat } from "../domain/operations";

export type OperationsView = { ab: AbRow[]; alerts: string[] };
type Row = Record<string, unknown>;
const rows = async (ex: Executor, q: ReturnType<typeof sql>): Promise<Row[]> => ((await ex.execute(q)) as unknown as { rows: Row[] }).rows;

export async function getVariantStats(ex: Executor, restaurantId: string): Promise<VariantStat[]> {
  const r = await rows(
    ex,
    sql`select pv.id, kp.kind, pv.label,
          (select count(*) from scans s where s.variant_id = pv.id)::int as scans,
          (select count(*) from checkins c where c.variant_id = pv.id)::int as checkins
        from piece_variants pv join kit_pieces kp on kp.id = pv.piece_id
        where pv.restaurant_id = ${restaurantId} and kp.kind in ('display', 'cartaz') and pv.retired_at is null`,
  );
  return r.map((x) => ({ id: String(x.id), kind: x.kind as VariantStat["kind"], label: x.label as VariantStat["label"], scans: Number(x.scans), checkins: Number(x.checkins) }));
}

export async function getOperations(ex: Executor, restaurantId: string, now: Date): Promise<OperationsView | null> {
  const ctx = await loadContext(ex, restaurantId);
  if (!ctx) return null;
  const ab = abTable(await getVariantStats(ex, restaurantId));
  const aliases = slotAliases(ctx.slots);
  const week = weekKeySP(now);
  const quota = await rows(ex, sql`select slot_id, cap, used from invite_quota where restaurant_id = ${restaurantId} and week_key = ${week}`);
  const caps = aliases.flatMap(({ alias, slot }) => {
    const q = quota.find((x) => x.slot_id === slot.id);
    return q ? [{ alias, cap: Number(q.cap), used: Number(q.used) }] : [];
  });
  const from = addDaysSP(daySP(now), -29);
  const turns = (
    await rows(
      ex,
      sql`select extract(dow from ck.day_sp::date)::int as wd, ck.turn, count(*)::int as codes, count(*) filter (where c.status = 'validado')::int as validated
          from codes c join checkins ck on ck.id = c.checkin_id
          where c.restaurant_id = ${restaurantId} and ck.day_sp >= ${from} and c.valid_day < ${daySP(now)}
          group by 1, 2`,
    )
  ).map((x) => ({ weekday: Number(x.wd), turn: x.turn as TurnCodes["turn"], codes: Number(x.codes), validated: Number(x.validated) }));
  const phrase = (alias: string) => {
    const s = aliases.find((a) => a.alias === alias)?.slot;
    return s ? slotPhrase(s) : alias;
  };
  return { ab, alerts: operationAlerts({ ab, caps, turns }).map((a) => alertText(a, phrase)) };
}
