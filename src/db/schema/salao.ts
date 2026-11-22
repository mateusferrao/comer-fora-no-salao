/**
 * Esquema v2 da S1 (espec. 4.2; planejamento S1 §6.3). Tudo aditivo (D103).
 * Toda linha tem o restaurante dono; eventos e clientes da simulação têm `simulation_run_id` (cascata).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { restaurants } from "./restaurants";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const restaurantFk = () =>
  uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" });

export const simulationRuns = pgTable(
  "simulation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    kind: text("kind").notNull(),
    seed: integer("seed").notNull(),
    version: integer("version").notNull(),
    params: jsonb("params").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("simulation_runs_restaurant_idx").on(t.restaurantId),
    check("simulation_runs_kind_check", sql`${t.kind} in ('vitrine', 'botao')`),
    // S3: uma rodada "Simular 30 dias" por restaurante (clique duplo → 1 rodada).
    uniqueIndex("simulation_runs_botao_uq").on(t.restaurantId).where(sql`kind = 'botao'`),
  ],
);

const runFk = () => uuid("simulation_run_id").references(() => simulationRuns.id, { onDelete: "cascade" });

export const idleSlots = pgTable(
  "idle_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    days: smallint("days").array().notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    intensity: text("intensity").notNull(),
    extraTables: integer("extra_tables").notNull(),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idle_slots_restaurant_idx").on(t.restaurantId),
    check(
      "idle_slots_intensity_check",
      sql`${t.intensity} in ('muito', 'medio', 'um_pouco')`,
    ),
    check(
      "idle_slots_range_check",
      sql`${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.startMin} < ${t.endMin}`,
    ),
  ],
);

export const menus = pgTable(
  "menus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    source: text("source").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("menus_restaurant_idx").on(t.restaurantId)],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    restaurantId: restaurantFk(),
    category: text("category").notNull(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    /** S6 (D197): "Pode entrar em ofertas" — fora das candidatas, do "agora" e da cartela quando falso. */
    offerAllowed: boolean("offer_allowed").notNull().default(true),
    /** S6 (D197, revisão técnica I6): exclusão lógica — a linha fica para códigos e textos antigos. */
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    index("menu_items_restaurant_idx").on(t.restaurantId),
    index("menu_items_menu_idx").on(t.menuId),
    check("menu_items_category_check", sql`${t.category} in ('entrada', 'prato', 'porcao', 'sobremesa', 'bebida')`),
    check("menu_items_price_check", sql`${t.priceCents} >= 0`),
  ],
);

export const weeklyPlans = pgTable(
  "weekly_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    weekKey: text("week_key").notNull(),
    status: text("status").notNull(),
    version: integer("version").notNull().default(1),
    facts: jsonb("facts").notNull(),
    candidates: jsonb("candidates").notNull(),
    choices: jsonb("choices").notNull(),
    texts: jsonb("texts").notNull(),
    learned: jsonb("learned").notNull(),
    decision: jsonb("decision"),
    approvedAt: ts("approved_at"),
    approvedVia: text("approved_via"),
    /** S6 (D158): passos do plano como agente (ferramenta, entrada resumida, saída resumida). */
    agentSteps: jsonb("agent_steps"),
    createdAt: ts("created_at").notNull().defaultNow(),
    simulationRunId: runFk(),
  },
  (t) => [
    index("weekly_plans_restaurant_idx").on(t.restaurantId),
    index("weekly_plans_run_idx").on(t.simulationRunId),
    check("weekly_plans_status_check", sql`${t.status} in ('gerando', 'proposto', 'aprovado', 'descartado', 'vencido')`),
  ],
);

export const benefits = pgTable(
  "benefits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    role: text("role").notNull(),
    slotId: uuid("slot_id").references(() => idleSlots.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("benefits_restaurant_idx").on(t.restaurantId),
    index("benefits_slot_idx").on(t.slotId),
    check("benefits_role_check", sql`${t.role} in ('agora', 'convite', 'recompensa')`),
  ],
);

export const benefitVersions = pgTable(
  "benefit_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    benefitId: uuid("benefit_id")
      .notNull()
      .references(() => benefits.id, { onDelete: "cascade" }),
    restaurantId: restaurantFk(),
    version: integer("version").notNull(),
    kind: text("kind").notNull(),
    params: jsonb("params").notNull(),
    weeklyCap: integer("weekly_cap"),
    planId: uuid("plan_id").references(() => weeklyPlans.id, { onDelete: "set null" }),
    validFrom: ts("valid_from").notNull(),
    supersededAt: ts("superseded_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    /** S2 (D122): texto do convite aprovado pelo dono, com referências; congelado com a versão. */
    inviteText: text("invite_text"),
  },
  (t) => [
    uniqueIndex("benefit_versions_benefit_version_uq").on(t.benefitId, t.version),
    // Uma só versão vigente por benefício (revisão da S2: duas edições simultâneas deixavam duas).
    uniqueIndex("benefit_versions_vigente_uq").on(t.benefitId).where(sql`${t.supersededAt} is null`),
    index("benefit_versions_restaurant_idx").on(t.restaurantId),
    index("benefit_versions_plan_idx").on(t.planId),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: ts("created_at").notNull().defaultNow(),
    simulationRunId: runFk(),
  },
  (t) => [index("customers_run_idx").on(t.simulationRunId)],
);

const customerFk = () =>
  uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" });

/**
 * PII isolada: apagar a pessoa = 1 linha. Telefone como HMAC + 4 dígitos + cifrado (D237).
 * S4 (D154, D169): o e-mail é a identidade do cliente (`email_hmac` único, finalidade `cliente-email:`) e fica
 * criptografado (AES-256-GCM) só para enviar convites; o telefone deixou de ser único.
 */
export const customerContacts = pgTable(
  "customer_contacts",
  {
    customerId: uuid("customer_id")
      .primaryKey()
      .references(() => customers.id, { onDelete: "cascade" }),
    /** S4 (D173): telefone opcional e nome preenchido no 2º passo do login (nulos até lá). */
    phoneHmac: text("phone_hmac"),
    phoneLast4: text("phone_last4"),
    /** D237: telefone inteiro cifrado (AES-GCM, chave própria) — o dono vê o contato completo do cliente. */
    phoneEnc: text("phone_enc"),
    name: text("name"),
    createdAt: ts("created_at").notNull().defaultNow(),
    emailHmac: text("email_hmac").unique(),
    emailEnc: text("email_enc"),
    emailHint: text("email_hint"),
    /** Última atividade (check-in ou login): a PII some 7 dias depois (D161). */
    lastSeenAt: ts("last_seen_at"),
  },
  (t) => [index("customer_contacts_phone_idx").on(t.phoneHmac)],
);

/** S4 (D154): código de 6 dígitos do cliente; os dados do formulário esperam aqui até a confirmação. */
export const customerLoginCodes = pgTable(
  "customer_login_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailHmac: text("email_hmac").notNull(),
    codeHmac: text("code_hmac").notNull(),
    /** D257: sem restaurante quando o cliente entra pela Jornada (sem check-in). */
    restaurantId: uuid("restaurant_id").references(() => restaurants.id, { onDelete: "cascade" }),
    /** { name, phoneHmac, phoneLast4, emailEnc, emailHint, optEmail, optApp } — sem PII em claro. */
    payload: jsonb("payload").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("customer_login_codes_email_idx").on(t.emailHmac, t.createdAt)],
);

export const kitPieces = pgTable(
  "kit_pieces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("rascunho"),
    inSalonAt: ts("in_salon_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("kit_pieces_restaurant_idx").on(t.restaurantId), check("kit_pieces_kind_check", sql`${t.kind} in ('display', 'cartaz', 'garcom', 'porta_conta')`)],
);

export const pieceVariants = pgTable(
  "piece_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => kitPieces.id, { onDelete: "cascade" }),
    restaurantId: restaurantFk(),
    label: text("label").notNull(),
    qrToken: text("qr_token").notNull().unique(),
    texts: jsonb("texts").notNull(),
    reviewerStatus: text("reviewer_status"),
    createdAt: ts("created_at").notNull().defaultNow(),
    /** S2: aprovação do dono (peças: `rascunho` → `aprovado` → `no_salao`). */
    approvedAt: ts("approved_at"),
    /** S3: versão substituída por outra (QR continua funcionando; o A/B a ignora). */
    retiredAt: ts("retired_at"),
    reviewerReasons: jsonb("reviewer_reasons"),
  },
  (t) => [index("piece_variants_piece_idx").on(t.pieceId), index("piece_variants_restaurant_idx").on(t.restaurantId)],
);

/** Relação cliente × restaurante: 1ª visita, opt-in, grupo (gravado 1 vez) e cartela corrente [C]. */
export const restaurantCustomers = pgTable(
  "restaurant_customers",
  {
    restaurantId: restaurantFk(),
    customerId: customerFk(),
    firstCheckinAt: ts("first_checkin_at"),
    lastCheckinDay: text("last_checkin_day"),
    firstVisitCodeIssued: boolean("first_visit_code_issued").notNull().default(false),
    optWhatsapp: boolean("opt_whatsapp").notNull().default(true),
    optApp: boolean("opt_app").notNull().default(true),
    optPush: boolean("opt_push").notNull().default(true),
    /** S4 (D155, D165): convites e lembretes por e-mail; ligado por padrão, como os outros canais. */
    optEmail: boolean("opt_email").notNull().default(true),
    /** S6 (D198): preferências por tipo de e-mail `{convites, lembretes}`; nulo = tudo ligado. `opt_email` é a chave-mestra. */
    emailPrefs: jsonb("email_prefs"),
    arm: text("arm"),
    armAssignedAt: ts("arm_assigned_at"),
    originVariantId: uuid("origin_variant_id").references(() => pieceVariants.id, { onDelete: "set null" }),
    cardStartedDay: text("card_started_day"),
    cardStamps: integer("card_stamps").notNull().default(0),
    cardLastDay: text("card_last_day"),
    cardCompletedDay: text("card_completed_day"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.restaurantId, t.customerId] }),
    index("restaurant_customers_customer_idx").on(t.customerId),
    index("restaurant_customers_variant_idx").on(t.originVariantId),
    check("restaurant_customers_arm_check", sql`${t.arm} is null or ${t.arm} in ('convidavel', 'holdout')`),
  ],
);

const variantFk = () => uuid("variant_id").references(() => pieceVariants.id, { onDelete: "set null" });

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    variantId: variantFk(),
    deviceHash: text("device_hash").notNull(),
    at: ts("at").notNull(),
    daySp: text("day_sp").notNull(),
    simulationRunId: runFk(),
  },
  (t) => [
    index("scans_restaurant_at_idx").on(t.restaurantId, t.at),
    index("scans_device_idx").on(t.deviceHash, t.variantId, t.at),
    index("scans_variant_idx").on(t.variantId),
    index("scans_run_idx").on(t.simulationRunId),
  ],
);

export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    customerId: customerFk(),
    at: ts("at").notNull(),
    daySp: text("day_sp").notNull(),
    turn: text("turn").notNull(),
    gpsStatus: text("gps_status").notNull(),
    variantId: variantFk(),
    benefitVersionId: uuid("benefit_version_id").references(() => benefitVersions.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    result: jsonb("result").notNull(),
    simulationRunId: runFk(),
  },
  (t) => [
    uniqueIndex("checkins_one_per_day_uq").on(t.restaurantId, t.customerId, t.daySp),
    index("checkins_restaurant_at_idx").on(t.restaurantId, t.at),
    index("checkins_customer_idx").on(t.customerId),
    index("checkins_variant_idx").on(t.variantId),
    index("checkins_benefit_version_idx").on(t.benefitVersionId),
    index("checkins_run_idx").on(t.simulationRunId),
  ],
);

export const planSends = pgTable(
  "plan_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => weeklyPlans.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    sentAt: ts("sent_at").notNull(),
    recipients: integer("recipients").notNull(),
    simulationRunId: runFk(),
  },
  (t) => [
    index("plan_sends_restaurant_idx").on(t.restaurantId),
    // S3: um envio por plano (aprovar 2× → 1 envio).
    uniqueIndex("plan_sends_plan_uq").on(t.planId),
    index("plan_sends_run_idx").on(t.simulationRunId),
  ],
);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    customerId: customerFk(),
    benefitVersionId: uuid("benefit_version_id").references(() => benefitVersions.id, { onDelete: "set null" }),
    slotId: uuid("slot_id").notNull(),
    /** Faixa congelada na emissão (D218): mudar o plano depois não altera o convite. */
    slotSnapshot: jsonb("slot_snapshot").notNull(),
    arm: text("arm").notNull(),
    status: text("status").notNull(),
    origin: text("origin").notNull(),
    issuedAt: ts("issued_at").notNull(),
    issuedDay: text("issued_day").notNull(),
    weekKey: text("week_key").notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    planSendId: uuid("plan_send_id").references(() => planSends.id, { onDelete: "set null" }),
    simulationRunId: runFk(),
    /** S3 (D141): só em restaurante de teste, "Antecipar" libera o convite fora da faixa neste dia (SP). */
    testValidDay: text("test_valid_day"),
    /** S3 (revisão #34): marcador de "antecipar 1 dia" (só restaurante de teste); a repetição só vale com ele. */
    advancedAt: ts("advanced_at"),
  },
  (t) => [
    // 1 convite ativo (real ou fantasma) por cliente por restaurante. Predicado literal: o drizzle-kit
    // 0.31 grava `where` parametrizado como `$1` (T-I10).
    uniqueIndex("invites_one_active_uq")
      .on(t.restaurantId, t.customerId)
      .where(sql`status in ('ativo', 'suprimido')`),
    index("invites_restaurant_issued_idx").on(t.restaurantId, t.issuedAt),
    index("invites_quota_idx").on(t.restaurantId, t.slotId, t.weekKey),
    index("invites_customer_idx").on(t.customerId),
    index("invites_benefit_version_idx").on(t.benefitVersionId),
    index("invites_plan_send_idx").on(t.planSendId),
    index("invites_run_idx").on(t.simulationRunId),
    check("invites_arm_check", sql`${t.arm} in ('convidavel', 'holdout')`),
    check("invites_status_check", sql`${t.status} in ('ativo', 'usado', 'expirado', 'suprimido')`),
    check("invites_origin_check", sql`${t.origin} in ('mesa', 'reativacao')`),
  ],
);

export const planSendMembers = pgTable(
  "plan_send_members",
  {
    sendId: uuid("send_id")
      .notNull()
      .references(() => planSends.id, { onDelete: "cascade" }),
    customerId: customerFk(),
    inviteId: uuid("invite_id").references(() => invites.id, { onDelete: "set null" }),
    arm: text("arm").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sendId, t.customerId] }), index("plan_send_members_customer_idx").on(t.customerId), index("plan_send_members_invite_idx").on(t.inviteId)],
);

export const codes = pgTable(
  "codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    customerId: customerFk(),
    type: text("type").notNull(),
    code: text("code").notNull(),
    itemId: uuid("item_id").references(() => menuItems.id, { onDelete: "set null" }),
    benefitVersionId: uuid("benefit_version_id").references(() => benefitVersions.id, { onDelete: "set null" }),
    inviteId: uuid("invite_id").references(() => invites.id, { onDelete: "cascade" }),
    checkinId: uuid("checkin_id").references(() => checkins.id, { onDelete: "cascade" }),
    validDay: text("valid_day").notNull(),
    status: text("status").notNull().default("emitido"),
    issuedAt: ts("issued_at").notNull(),
    validatedAt: ts("validated_at"),
    validationKey: text("validation_key"),
    simulationRunId: runFk(),
  },
  (t) => [
    uniqueIndex("codes_restaurant_code_uq").on(t.restaurantId, t.code),
    index("codes_customer_idx").on(t.customerId),
    index("codes_invite_idx").on(t.inviteId),
    index("codes_checkin_idx").on(t.checkinId),
    index("codes_item_idx").on(t.itemId),
    index("codes_benefit_version_idx").on(t.benefitVersionId),
    index("codes_restaurant_day_idx").on(t.restaurantId, t.validDay),
    index("codes_run_idx").on(t.simulationRunId),
    check("codes_type_check", sql`${t.type} in ('primeira_visita', 'convite', 'recompensa')`),
    check("codes_status_check", sql`${t.status} in ('emitido', 'validado')`),
  ],
);

/** Teto por faixa e semana ISO em SP; `used` é recontado sob lock da linha (T-I4). */
export const inviteQuota = pgTable(
  "invite_quota",
  {
    restaurantId: restaurantFk(),
    slotId: uuid("slot_id").notNull(),
    weekKey: text("week_key").notNull(),
    cap: integer("cap").notNull(),
    used: integer("used").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.restaurantId, t.slotId, t.weekKey] }), check("invite_quota_used_check", sql`${t.used} >= 0`)],
);


/** S4 (D155): convite entregue no app do cliente (Jornada › Seus convites); lido/não lido. */
export const customerMessages = pgTable(
  "customer_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: customerFk(),
    restaurantId: restaurantFk(),
    inviteId: uuid("invite_id").references(() => invites.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    readAt: ts("read_at"),
    emailedAt: ts("emailed_at"),
    /** Envio do e-mail depois do commit (D163, revisão S4 I4): `pendente` → `enviado` | `pulado` | `falhou`. */
    emailStatus: text("email_status").notNull().default("pulado"),
    /** S6 (revisão técnica I1): por que o e-mail foi pulado — `dono_desligou` | `cliente_desligou` | `contato_no_texto` | ... */
    emailSkipReason: text("email_skip_reason"),
    simulationRunId: runFk(),
  },
  (t) => [
    index("customer_messages_customer_idx").on(t.customerId, t.createdAt),
    index("customer_messages_pending_idx").on(t.restaurantId).where(sql`email_status = 'pendente'`),
    check("customer_messages_email_status_check", sql`${t.emailStatus} in ('pendente', 'enviado', 'pulado', 'falhou')`),
    uniqueIndex("customer_messages_invite_uq").on(t.inviteId, t.kind),
    check("customer_messages_kind_check", sql`${t.kind} in ('convite_mesa', 'reativacao', 'lembrete')`),
  ],
);

/** S6 (D163, D168): resumo semanal do dono, 1 por restaurante e semana ISO (SP); reservado → enviado. */
export const weeklyDigests = pgTable(
  "weekly_digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    weekKey: text("week_key").notNull(),
    status: text("status").notNull(),
    planId: uuid("plan_id").references(() => weeklyPlans.id, { onDelete: "set null" }),
    reservedAt: ts("reserved_at").notNull(),
    sentAt: ts("sent_at"),
    via: text("via").notNull(),
  },
  (t) => [uniqueIndex("weekly_digests_week_uq").on(t.restaurantId, t.weekKey), check("weekly_digests_status_check", sql`${t.status} in ('reservado', 'enviado', 'falhou')`)],
);

/** S6: token de "Revisar e aprovar" do e-mail (hash; uso único; amarrado ao plano). */
export const digestTokens = pgTable("digest_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  restaurantId: restaurantFk(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => weeklyPlans.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** S6 (D158): link do garçom — abre só "Validar código" (hash; revogável). */
export const waiterTokens = pgTable(
  "waiter_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: restaurantFk(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [
    index("waiter_tokens_restaurant_idx").on(t.restaurantId),
    /** S6 (D190): 1 link ativo por restaurante. */
    uniqueIndex("waiter_tokens_active_uq").on(t.restaurantId).where(sql`revoked_at is null`),
  ],
);
