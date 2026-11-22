/**
 * S8 — Copiloto do salão (D260–D271): propostas de mudança feitas pelo copiloto do Portal ou por agentes via MCP.
 * A proposta só vira mudança quando o dono clica "Aplicar" (Portal — D261) ou o agente chama `aplicar_proposta`
 * (MCP — D269). A conversa não é guardada no servidor (D271); aqui só a ação e a prévia, sem texto do dono.
 */
import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { restaurants } from "./restaurants";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const agentProposals = pgTable(
  "agent_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    origin: text("origin").notNull(),
    action: text("action").notNull(),
    payload: jsonb("payload").notNull(),
    preview: jsonb("preview").notNull(),
    /** sha256 do "antes" canônico: se mudou até a hora de aplicar, a proposta expira (revisão técnica B5). */
    baseHash: text("base_hash").notNull(),
    status: text("status").notNull().default("pendente"),
    error: text("error"),
    aiCallId: uuid("ai_call_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
    decidedAt: ts("decided_at"),
  },
  (t) => [
    index("agent_proposals_restaurant_idx").on(t.restaurantId, t.createdAt),
    check("agent_proposals_origin_check", sql`${t.origin} in ('copiloto', 'mcp')`),
    check("agent_proposals_status_check", sql`${t.status} in ('pendente', 'aplicando', 'aplicada', 'descartada', 'expirada', 'falhou')`),
  ],
);
