/**
 * Esquema da S2 (planejamento S2 §6.3): login do dono, limites persistidos, extração do cardápio,
 * edições do dono, abandono do assistente e rastro resumido da IA. Tudo aditivo (D103).
 */
import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { restaurants } from "./restaurants";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Código de login de 6 dígitos (D118): só HMAC; um novo invalida o anterior. */
export const loginCodes = pgTable(
  "login_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailHmac: text("email_hmac").notNull(),
    codeHmac: text("code_hmac").notNull(),
    expiresAt: ts("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: ts("used_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("login_codes_email_idx").on(t.emailHmac, t.createdAt)],
);

/** Janela fixa por chave (`consume`): substitui os limites em memória da D115. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_window_idx").on(t.windowStart)],
);

/** Extração do cardápio em segundo plano. A imagem nunca é gravada (D50); só o hash dos exemplos. */
export const menuExtractions = pgTable(
  "menu_extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    inputHash: text("input_hash"),
    status: text("status").notNull(),
    result: jsonb("result"),
    model: text("model"),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
  },
  (t) => [
    index("menu_extractions_restaurant_idx").on(t.restaurantId),
    check("menu_extractions_source_check", sql`${t.source} in ('foto', 'pdf', 'exemplo', 'importado')`),
    check("menu_extractions_status_check", sql`${t.status} in ('lendo', 'pronto', 'falhou', 'nao_cardapio')`),
  ],
);

/** Sugestão × versão final do dono (qualidade da IA, H4). */
export const ownerEdits = pgTable(
  "owner_edits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    ref: text("ref"),
    suggested: jsonb("suggested"),
    final: jsonb("final"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("owner_edits_restaurant_idx").on(t.restaurantId, t.at)],
);

/** Entrada e saída de cada passo do assistente (abandono por passo — H5). */
export const onboardingEvents = pgTable(
  "onboarding_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    step: integer("step").notNull(),
    event: text("event").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("onboarding_events_restaurant_idx").on(t.restaurantId, t.at), check("onboarding_events_event_check", sql`${t.event} in ('entrou', 'concluiu')`)],
);

/** Resumo de cada chamada de IA (sem conteúdo): custo, modelo, guardrails (espec. 4.8). */
export const aiCalls = pgTable(
  "ai_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    task: text("task").notNull(),
    promptVersion: text("prompt_version").notNull(),
    restaurantId: uuid("restaurant_id").references(() => restaurants.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    reason: text("reason"),
    model: text("model"),
    servedModel: text("served_model"),
    inTokens: integer("in_tokens"),
    outTokens: integer("out_tokens"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    latencyMs: integer("latency_ms"),
    attempts: jsonb("attempts").notNull(),
    keyKind: text("key_kind").notNull(),
    at: ts("at").notNull().defaultNow(),
    /** S3: alvo da chamada (peça revisada, plano), para "IA ≠ maior nota" e o revisor. */
    ref: text("ref"),
    planId: uuid("plan_id"),
  },
  (t) => [index("ai_calls_at_idx").on(t.at), index("ai_calls_restaurant_idx").on(t.restaurantId)],
);
