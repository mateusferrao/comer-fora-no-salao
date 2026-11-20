import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { owners } from "./owners";

export const RESTAURANT_KINDS = ["vitrine", "teste"] as const;
export const RESTAURANT_STATUSES = ["rascunho", "ativo"] as const;

export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    kind: text("kind", { enum: RESTAURANT_KINDS }).notNull(),
    name: text("name").notNull(),
    cuisine: text("cuisine"),
    priceBand: text("price_band"),
    openingHours: jsonb("opening_hours"),
    /** Obsoleta desde a v2 (faixas em `idle_slots`); fica até o congelamento (D103). */
    idleHours: jsonb("idle_hours"),
    tables: integer("tables"),
    weeklyCustomers: integer("weekly_customers"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    status: text("status", { enum: RESTAURANT_STATUSES }).notNull().default("rascunho"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // v2 (S1, migração 0001 — só aditiva)
    ticketCents: integer("ticket_cents"),
    marginPct: integer("margin_pct"),
    description: text("description"),
    address: text("address"),
    heroImage: text("hero_image"),
    recado: text("recado"),
    /** Vitrine e restaurante E2E: fora de qualquer limpeza automática (T-I8). */
    protected: boolean("protected").notNull().default(false),
    // S2 (0002): assistente retomável e cópia da vitrine por conta (D119).
    onboardingStep: integer("onboarding_step"),
    /** Id da vitrine de origem (sem FK: a original pode ser recriada pelo seed). */
    copiedFrom: uuid("copied_from"),
    /** Preparação em segundo plano da cópia: `criando` | `pronta` | `falhou`; nulo = não se aplica. */
    setupStatus: text("setup_status"),
    setupStartedAt: timestamp("setup_started_at", { withTimezone: true }),
    // S3 (0004): tom da IA escolhido pelo dono (D138), dado delimitado no prompt.
    aiTone: text("ai_tone"),
  },
  (t) => [
    check("restaurants_kind_check", sql`${t.kind} in ('vitrine', 'teste')`),
    check("restaurants_status_check", sql`${t.status} in ('rascunho', 'ativo')`),
    index("restaurants_owner_id_idx").on(t.ownerId),
  ],
);
