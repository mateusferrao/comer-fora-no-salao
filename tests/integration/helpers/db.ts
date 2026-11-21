import { sql } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { runMigrations } from "@/src/db/migrate";
import { buildRestaurant, type RestaurantSpec } from "@/src/db/seed/builder";

export async function resetDb() {
  await runMigrations();
  await getDb().execute(sql`truncate owners, customers, simulation_runs, rate_limits, login_codes, ai_calls, app_config, app_config_versions restart identity cascade`);
}

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function testSpec(p: Partial<RestaurantSpec> = {}): RestaurantSpec {
  return {
    owner: { kind: "teste" },
    slug: `t-${Math.random().toString(36).slice(2, 10)}`,
    kind: "teste",
    name: "Cantina de Teste",
    opening: [{ days: ALL_DAYS, startMin: 0, endMin: 1440 }],
    activatedAt: new Date("2026-09-01T12:00:00Z"),
    menu: [
      { key: "panna", category: "sobremesa", name: "Panna cotta", priceCents: 1800 },
      { key: "cannoli", category: "sobremesa", name: "Cannoli", priceCents: 2200 },
      { key: "tiramisu", category: "sobremesa", name: "Tiramisù", priceCents: 2600 },
      { key: "bruschetta", category: "entrada", name: "Bruschetta", priceCents: 2600 },
    ],
    agora: { kind: "doce_gratis", item: "panna" },
    recompensa: { kind: "doce_gratis", item: "tiramisu" },
    slots: [{ key: "A", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 5, convite: { kind: "doce_gratis", item: "cannoli" }, weeklyCap: 20 }],
    ...p,
  };
}

export async function createRestaurant(p: Partial<RestaurantSpec> = {}) {
  return buildRestaurant(getDb(), testSpec(p));
}
