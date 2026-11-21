CREATE TABLE "agent_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb NOT NULL,
	"preview" jsonb NOT NULL,
	"base_hash" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"error" text,
	"ai_call_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "agent_proposals_origin_check" CHECK ("agent_proposals"."origin" in ('copiloto', 'mcp')),
	CONSTRAINT "agent_proposals_status_check" CHECK ("agent_proposals"."status" in ('pendente', 'aplicando', 'aplicada', 'descartada', 'expirada', 'falhou'))
);
--> statement-breakpoint
ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_proposals_restaurant_idx" ON "agent_proposals" USING btree ("restaurant_id","created_at");