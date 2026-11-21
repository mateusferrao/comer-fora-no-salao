import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const OWNER_KINDS = ["demo", "teste"] as const;

export const owners = pgTable(
  "owners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind", { enum: OWNER_KINDS }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // S2 (migração 0002 — só aditiva): login por e-mail real (D118) e link do avaliador (D126).
    /** HMAC-SHA256 do e-mail normalizado (finalidade `email:`); o e-mail em claro nunca é gravado. */
    emailHmac: text("email_hmac"),
    /** Dica mascarada para o rodapé do Portal ("m•••@d•••.com" ou "acesso por link"). */
    emailHint: text("email_hint"),
    /** S4 (D163, D169): e-mail criptografado (AES-256-GCM) só para o resumo semanal; muda a D118. */
    emailEnc: text("email_enc"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** Como a conta nasceu: `email` | `link` | `e2e`; nulo = contas do seed (vitrine, E2E da S1). */
    via: text("via"),
  },
  (t) => [
    check("owners_kind_check", sql`${t.kind} in ('demo', 'teste')`),
    uniqueIndex("owners_email_hmac_uq").on(t.emailHmac),
    check("owners_via_check", sql`${t.via} is null or ${t.via} in ('email', 'link', 'e2e')`),
  ],
);
