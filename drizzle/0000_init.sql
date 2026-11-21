CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_kind_check" CHECK ("owners"."kind" in ('demo', 'teste'))
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"cuisine" text,
	"price_band" text,
	"opening_hours" jsonb,
	"idle_hours" jsonb,
	"tables" integer,
	"weekly_customers" integer,
	"lat" double precision,
	"lng" double precision,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "restaurants_kind_check" CHECK ("restaurants"."kind" in ('vitrine', 'teste')),
	CONSTRAINT "restaurants_status_check" CHECK ("restaurants"."status" in ('rascunho', 'ativo'))
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;