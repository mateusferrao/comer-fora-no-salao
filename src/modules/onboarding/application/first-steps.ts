/**
 * "Primeiros passos" do restaurante cadastrado (S4 §4.4; revisão de produto I7): checklist que se marca sozinha
 * pelos eventos reais, terminando no momento de valor — o 1º cliente que voltou com convite.
 */
import { sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";

export type FirstSteps = { kitNoSalao: boolean; primeiroCheckin: boolean; primeiroCodigo: boolean; primeiraVolta: boolean };

export async function firstSteps(ex: Executor, restaurantId: string): Promise<FirstSteps> {
  const res = (await ex.execute(sql`select
      exists (select 1 from kit_pieces where restaurant_id = ${restaurantId} and in_salon_at is not null) as kit,
      exists (select 1 from checkins where restaurant_id = ${restaurantId} and simulation_run_id is null) as ck,
      exists (select 1 from codes where restaurant_id = ${restaurantId} and status = 'validado' and simulation_run_id is null) as cod,
      exists (select 1 from codes where restaurant_id = ${restaurantId} and type = 'convite' and simulation_run_id is null) as volta`)) as unknown as { rows: Array<Record<string, boolean>> };
  const r = res.rows[0]!;
  return { kitNoSalao: r.kit === true, primeiroCheckin: r.ck === true, primeiroCodigo: r.cod === true, primeiraVolta: r.volta === true };
}
