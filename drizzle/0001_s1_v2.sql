CREATE TABLE "benefit_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benefit_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"kind" text NOT NULL,
	"params" jsonb NOT NULL,
	"weekly_cap" integer,
	"plan_id" uuid,
	"valid_from" timestamp with time zone NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"role" text NOT NULL,
	"slot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "benefits_role_check" CHECK ("benefits"."role" in ('agora', 'convite', 'recompensa'))
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"day_sp" text NOT NULL,
	"turn" text NOT NULL,
	"gps_status" text NOT NULL,
	"variant_id" uuid,
	"benefit_version_id" uuid,
	"idempotency_key" text NOT NULL,
	"result" jsonb NOT NULL,
	"simulation_run_id" uuid,
	CONSTRAINT "checkins_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" text NOT NULL,
	"code" text NOT NULL,
	"item_id" uuid,
	"benefit_version_id" uuid,
	"invite_id" uuid,
	"checkin_id" uuid,
	"valid_day" text NOT NULL,
	"status" text DEFAULT 'emitido' NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"validated_at" timestamp with time zone,
	"validation_key" text,
	"simulation_run_id" uuid,
	CONSTRAINT "codes_type_check" CHECK ("codes"."type" in ('primeira_visita', 'convite', 'recompensa')),
	CONSTRAINT "codes_status_check" CHECK ("codes"."status" in ('emitido', 'validado'))
);
--> statement-breakpoint
CREATE TABLE "customer_contacts" (
	"customer_id" uuid PRIMARY KEY NOT NULL,
	"phone_hmac" text NOT NULL,
	"phone_last4" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_contacts_phone_hmac_unique" UNIQUE("phone_hmac")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"simulation_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "idle_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"days" smallint[] NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"intensity" text NOT NULL,
	"extra_tables" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idle_slots_intensity_check" CHECK ("idle_slots"."intensity" in ('muito', 'um_pouco')),
	CONSTRAINT "idle_slots_range_check" CHECK ("idle_slots"."start_min" >= 0 and "idle_slots"."end_min" <= 1440 and "idle_slots"."start_min" < "idle_slots"."end_min")
);
--> statement-breakpoint
CREATE TABLE "invite_quota" (
	"restaurant_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"week_key" text NOT NULL,
	"cap" integer NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invite_quota_restaurant_id_slot_id_week_key_pk" PRIMARY KEY("restaurant_id","slot_id","week_key"),
	CONSTRAINT "invite_quota_used_check" CHECK ("invite_quota"."used" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"benefit_version_id" uuid,
	"slot_id" uuid NOT NULL,
	"slot_snapshot" jsonb NOT NULL,
	"arm" text NOT NULL,
	"status" text NOT NULL,
	"origin" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"issued_day" text NOT NULL,
	"week_key" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"plan_send_id" uuid,
	"simulation_run_id" uuid,
	CONSTRAINT "invites_arm_check" CHECK ("invites"."arm" in ('convidavel', 'holdout')),
	CONSTRAINT "invites_status_check" CHECK ("invites"."status" in ('ativo', 'usado', 'expirado', 'suprimido')),
	CONSTRAINT "invites_origin_check" CHECK ("invites"."origin" in ('mesa', 'reativacao'))
);
--> statement-breakpoint
CREATE TABLE "kit_pieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"in_salon_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kit_pieces_kind_check" CHECK ("kit_pieces"."kind" in ('display', 'cartaz', 'garcom'))
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "menu_items_category_check" CHECK ("menu_items"."category" in ('entrada', 'prato', 'porcao', 'sobremesa', 'bebida')),
	CONSTRAINT "menu_items_price_check" CHECK ("menu_items"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piece_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"piece_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"label" text NOT NULL,
	"qr_token" text NOT NULL,
	"texts" jsonb NOT NULL,
	"reviewer_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "piece_variants_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "plan_send_members" (
	"send_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"invite_id" uuid,
	"arm" text NOT NULL,
	CONSTRAINT "plan_send_members_send_id_customer_id_pk" PRIMARY KEY("send_id","customer_id")
);
--> statement-breakpoint
CREATE TABLE "plan_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"recipients" integer NOT NULL,
	"simulation_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "restaurant_customers" (
	"restaurant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"first_checkin_at" timestamp with time zone,
	"last_checkin_day" text,
	"first_visit_code_issued" boolean DEFAULT false NOT NULL,
	"opt_whatsapp" boolean DEFAULT true NOT NULL,
	"opt_app" boolean DEFAULT true NOT NULL,
	"opt_push" boolean DEFAULT true NOT NULL,
	"arm" text,
	"arm_assigned_at" timestamp with time zone,
	"origin_variant_id" uuid,
	"card_started_day" text,
	"card_stamps" integer DEFAULT 0 NOT NULL,
	"card_last_day" text,
	"card_completed_day" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_customers_restaurant_id_customer_id_pk" PRIMARY KEY("restaurant_id","customer_id"),
	CONSTRAINT "restaurant_customers_arm_check" CHECK ("restaurant_customers"."arm" is null or "restaurant_customers"."arm" in ('convidavel', 'holdout'))
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"variant_id" uuid,
	"device_hash" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"day_sp" text NOT NULL,
	"simulation_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "simulation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"seed" integer NOT NULL,
	"version" integer NOT NULL,
	"params" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulation_runs_kind_check" CHECK ("simulation_runs"."kind" in ('vitrine', 'botao'))
);
--> statement-breakpoint
CREATE TABLE "weekly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"week_key" text NOT NULL,
	"status" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"facts" jsonb NOT NULL,
	"candidates" jsonb NOT NULL,
	"choices" jsonb NOT NULL,
	"texts" jsonb NOT NULL,
	"learned" jsonb NOT NULL,
	"decision" jsonb,
	"approved_at" timestamp with time zone,
	"approved_via" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"simulation_run_id" uuid,
	CONSTRAINT "weekly_plans_status_check" CHECK ("weekly_plans"."status" in ('gerando', 'proposto', 'aprovado', 'descartado', 'vencido'))
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "ticket_cents" integer;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "margin_pct" integer;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "hero_image" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "recado" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "protected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "benefit_versions" ADD CONSTRAINT "benefit_versions_benefit_id_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."benefits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_versions" ADD CONSTRAINT "benefit_versions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_versions" ADD CONSTRAINT "benefit_versions_plan_id_weekly_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_slot_id_idle_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."idle_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_variant_id_piece_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."piece_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_benefit_version_id_benefit_versions_id_fk" FOREIGN KEY ("benefit_version_id") REFERENCES "public"."benefit_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_simulation_run_id_simulation_runs_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_benefit_version_id_benefit_versions_id_fk" FOREIGN KEY ("benefit_version_id") REFERENCES "public"."benefit_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_checkin_id_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_simulation_run_id_simulation_runs_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_simulation_run_id_simulation_runs_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idle_slots" ADD CONSTRAINT "idle_slots_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_quota" ADD CONSTRAINT "invite_quota_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_benefit_version_id_benefit_versions_id_fk" FOREIGN KEY ("benefit_version_id") REFERENCES "public"."benefit_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_plan_send_id_plan_sends_id_fk" FOREIGN KEY ("plan_send_id") REFERENCES "public"."plan_sends"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_simulation_run_id_simulation_runs_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_pieces" ADD CONSTRAINT "kit_pieces_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_variants" ADD CONSTRAINT "piece_variants_piece_id_kit_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."kit_pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_variants" ADD CONSTRAINT "piece_variants_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_send_members" ADD CONSTRAINT "plan_send_members_send_id_plan_sends_id_fk" FOREIGN KEY ("send_id") REFERENCES "public"."plan_sends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_send_members" ADD CONSTRAINT "plan_send_members_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_send_members" ADD CONSTRAINT "plan_send_members_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_sends" ADD CONSTRAINT "plan_sends_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_sends" ADD CONSTRAINT "plan_sends_plan_id_weekly_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_sends" ADD CONSTRAINT "plan_sends_simulation_run_id_simulation_runs_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_customers" ADD CONSTRAINT "restaurant_customers_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_customers" ADD CONSTRAINT "restaurant_customers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_customers" ADD CONSTRAINT "restaurant_customers_origin_variant_id_piece_variants_id_fk" FOREIGN KEY ("origin_variant_id") REFERENCES "public"."piece_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_variant_id_piece_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."piece_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_simulation_run_id_simulation_runs_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_simulation_run_id_simulation_runs_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "benefit_versions_benefit_version_uq" ON "benefit_versions" USING btree ("benefit_id","version");--> statement-breakpoint
CREATE INDEX "benefit_versions_restaurant_idx" ON "benefit_versions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "benefit_versions_plan_idx" ON "benefit_versions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "benefits_restaurant_idx" ON "benefits" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "benefits_slot_idx" ON "benefits" USING btree ("slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkins_one_per_day_uq" ON "checkins" USING btree ("restaurant_id","customer_id","day_sp");--> statement-breakpoint
CREATE INDEX "checkins_restaurant_at_idx" ON "checkins" USING btree ("restaurant_id","at");--> statement-breakpoint
CREATE INDEX "checkins_customer_idx" ON "checkins" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "checkins_variant_idx" ON "checkins" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "checkins_benefit_version_idx" ON "checkins" USING btree ("benefit_version_id");--> statement-breakpoint
CREATE INDEX "checkins_run_idx" ON "checkins" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "codes_restaurant_code_uq" ON "codes" USING btree ("restaurant_id","code");--> statement-breakpoint
CREATE INDEX "codes_customer_idx" ON "codes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "codes_invite_idx" ON "codes" USING btree ("invite_id");--> statement-breakpoint
CREATE INDEX "codes_checkin_idx" ON "codes" USING btree ("checkin_id");--> statement-breakpoint
CREATE INDEX "codes_item_idx" ON "codes" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "codes_benefit_version_idx" ON "codes" USING btree ("benefit_version_id");--> statement-breakpoint
CREATE INDEX "codes_restaurant_day_idx" ON "codes" USING btree ("restaurant_id","valid_day");--> statement-breakpoint
CREATE INDEX "codes_run_idx" ON "codes" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE INDEX "customers_run_idx" ON "customers" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE INDEX "idle_slots_restaurant_idx" ON "idle_slots" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_one_active_uq" ON "invites" USING btree ("restaurant_id","customer_id") WHERE status in ('ativo', 'suprimido');--> statement-breakpoint
CREATE INDEX "invites_restaurant_issued_idx" ON "invites" USING btree ("restaurant_id","issued_at");--> statement-breakpoint
CREATE INDEX "invites_quota_idx" ON "invites" USING btree ("restaurant_id","slot_id","week_key");--> statement-breakpoint
CREATE INDEX "invites_customer_idx" ON "invites" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invites_benefit_version_idx" ON "invites" USING btree ("benefit_version_id");--> statement-breakpoint
CREATE INDEX "invites_plan_send_idx" ON "invites" USING btree ("plan_send_id");--> statement-breakpoint
CREATE INDEX "invites_run_idx" ON "invites" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE INDEX "kit_pieces_restaurant_idx" ON "kit_pieces" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_items_restaurant_idx" ON "menu_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_items_menu_idx" ON "menu_items" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "menus_restaurant_idx" ON "menus" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "piece_variants_piece_idx" ON "piece_variants" USING btree ("piece_id");--> statement-breakpoint
CREATE INDEX "piece_variants_restaurant_idx" ON "piece_variants" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "plan_send_members_customer_idx" ON "plan_send_members" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "plan_send_members_invite_idx" ON "plan_send_members" USING btree ("invite_id");--> statement-breakpoint
CREATE INDEX "plan_sends_restaurant_idx" ON "plan_sends" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "plan_sends_plan_idx" ON "plan_sends" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_sends_run_idx" ON "plan_sends" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE INDEX "restaurant_customers_customer_idx" ON "restaurant_customers" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "restaurant_customers_variant_idx" ON "restaurant_customers" USING btree ("origin_variant_id");--> statement-breakpoint
CREATE INDEX "scans_restaurant_at_idx" ON "scans" USING btree ("restaurant_id","at");--> statement-breakpoint
CREATE INDEX "scans_device_idx" ON "scans" USING btree ("device_hash","variant_id","at");--> statement-breakpoint
CREATE INDEX "scans_variant_idx" ON "scans" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "scans_run_idx" ON "scans" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE INDEX "simulation_runs_restaurant_idx" ON "simulation_runs" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "weekly_plans_restaurant_idx" ON "weekly_plans" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "weekly_plans_run_idx" ON "weekly_plans" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE INDEX "restaurants_owner_id_idx" ON "restaurants" USING btree ("owner_id");