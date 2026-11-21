/**
 * "Últimos check-ins de hoje" (D172): os 10 últimos check-ins reais do dia em SP, com a marca do grupo de
 * controle — é aqui (só para o dono) que o controle aparece; o cliente nunca vê. Sem o histórico gerado.
 */
import { sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { fullName } from "@/src/shared/contact";
import { daySP } from "@/src/shared/tz";

export type RecentCheckin = { at: string; name: string; firstVisit: boolean; controle: boolean; validated: boolean };

export async function getRecentCheckins(ex: Executor, restaurantId: string, now: Date, limit = 10): Promise<RecentCheckin[]> {
  const today = daySP(now);
  const since = new Date(now.getTime() - 26 * 3_600_000);
  const res = (await ex.execute(sql`
    select c.at, c.result->>'outcome' as outcome, cc.name, rc.arm,
      exists (select 1 from codes k where k.restaurant_id = c.restaurant_id and k.customer_id = c.customer_id and k.valid_day = c.day_sp and k.status = 'validado') as validated
    from checkins c
    join customers cu on cu.id = c.customer_id and cu.simulation_run_id is null
    left join customer_contacts cc on cc.customer_id = c.customer_id
    left join restaurant_customers rc on rc.restaurant_id = c.restaurant_id and rc.customer_id = c.customer_id
    where c.restaurant_id = ${restaurantId} and c.at >= ${since.toISOString()} and c.day_sp = ${today} and c.simulation_run_id is null
    order by c.at desc
    limit ${limit}`)) as unknown as { rows: Array<Record<string, unknown>> };
  return res.rows.map((r) => ({
    at: new Date(String(r.at)).toISOString(),
    name: fullName(r.name == null ? null : String(r.name)),
    firstVisit: r.outcome === "primeira_visita",
    controle: r.arm === "holdout",
    validated: r.validated === true,
  }));
}
