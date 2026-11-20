CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_config_versions" (
	"key" text NOT NULL,
	"version" integer NOT NULL,
	"value" jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_config_versions_key_version_pk" PRIMARY KEY("key","version")
);
--> statement-breakpoint
CREATE TABLE "mcp_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"hint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "mcp_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "ai_tone" text;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "test_valid_day" text;--> statement-breakpoint
ALTER TABLE "piece_variants" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "piece_variants" ADD COLUMN "reviewer_reasons" jsonb;--> statement-breakpoint
ALTER TABLE "ai_calls" ADD COLUMN "ref" text;--> statement-breakpoint
ALTER TABLE "ai_calls" ADD COLUMN "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_tokens_restaurant_idx" ON "mcp_tokens" USING btree ("restaurant_id");--> statement-breakpoint
-- Defesa (revisão S3): envios simulados duplicados por plano impediriam o índice único e o boot com o banco.
DELETE FROM "plan_sends" a USING "plan_sends" b WHERE a."plan_id" = b."plan_id" AND a."plan_id" IS NOT NULL AND a."id" > b."id";--> statement-breakpoint
CREATE UNIQUE INDEX "plan_sends_plan_uq" ON "plan_sends" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "simulation_runs_botao_uq" ON "simulation_runs" USING btree ("restaurant_id") WHERE kind = 'botao';