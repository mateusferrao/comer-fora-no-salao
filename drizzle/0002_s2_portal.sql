CREATE TABLE "ai_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task" text NOT NULL,
	"prompt_version" text NOT NULL,
	"restaurant_id" uuid,
	"status" text NOT NULL,
	"reason" text,
	"model" text,
	"served_model" text,
	"in_tokens" integer,
	"out_tokens" integer,
	"cost_usd" numeric(12, 6),
	"latency_ms" integer,
	"attempts" jsonb NOT NULL,
	"key_kind" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hmac" text NOT NULL,
	"code_hmac" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"input_hash" text,
	"status" text NOT NULL,
	"result" jsonb,
	"model" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "menu_extractions_source_check" CHECK ("menu_extractions"."source" in ('foto', 'pdf', 'exemplo', 'importado')),
	CONSTRAINT "menu_extractions_status_check" CHECK ("menu_extractions"."status" in ('lendo', 'pronto', 'falhou', 'nao_cardapio'))
);
--> statement-breakpoint
CREATE TABLE "onboarding_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"event" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_events_event_check" CHECK ("onboarding_events"."event" in ('entrou', 'concluiu'))
);
--> statement-breakpoint
CREATE TABLE "owner_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref" text,
	"suggested" jsonb,
	"final" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "email_hmac" text;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "email_hint" text;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "via" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "onboarding_step" integer;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "copied_from" uuid;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "setup_status" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "setup_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "benefit_versions" ADD COLUMN "invite_text" text;--> statement-breakpoint
ALTER TABLE "piece_variants" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_extractions" ADD CONSTRAINT "menu_extractions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_events" ADD CONSTRAINT "onboarding_events_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_edits" ADD CONSTRAINT "owner_edits_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_calls_at_idx" ON "ai_calls" USING btree ("at");--> statement-breakpoint
CREATE INDEX "ai_calls_restaurant_idx" ON "ai_calls" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "login_codes_email_idx" ON "login_codes" USING btree ("email_hmac","created_at");--> statement-breakpoint
CREATE INDEX "menu_extractions_restaurant_idx" ON "menu_extractions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "onboarding_events_restaurant_idx" ON "onboarding_events" USING btree ("restaurant_id","at");--> statement-breakpoint
CREATE INDEX "owner_edits_restaurant_idx" ON "owner_edits" USING btree ("restaurant_id","at");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "owners_email_hmac_uq" ON "owners" USING btree ("email_hmac");--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_via_check" CHECK ("owners"."via" is null or "owners"."via" in ('email', 'link', 'e2e'));