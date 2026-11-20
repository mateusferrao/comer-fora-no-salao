/**
 * Esquema da S3 (planejamento S3 §6.3): configuração ao vivo (D58, D138) e tokens do MCP (D219). Tudo aditivo (D103).
 */
import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { restaurants } from "./restaurants";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Versões imutáveis por chave (`prompt:<tarefa>`, `flags`). */
export const appConfigVersions = pgTable(
  "app_config_versions",
  {
    key: text("key").notNull(),
    version: integer("version").notNull(),
    value: jsonb("value").notNull(),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.key, t.version] })],
);

/** Ponteiro para a versão em uso. Sem linha: vale o texto do código (versão 0). */
export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  version: integer("version").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Token do dono para o MCP (D219): só o hash; revogável; 1 restaurante. */
export const mcpTokens = pgTable(
  "mcp_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    hint: text("hint").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("mcp_tokens_restaurant_idx").on(t.restaurantId)],
);
