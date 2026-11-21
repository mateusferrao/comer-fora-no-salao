CREATE TABLE "customer_login_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hmac" text NOT NULL,
	"code_hmac" text NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"invite_id" uuid,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"email_status" text DEFAULT 'pulado' NOT NULL,
	"simulation_run_id" uuid,
	CONSTRAINT "customer_messages_email_status_check" CHECK ("customer_messages"."email_status" in ('pendente', 'enviado', 'pulado', 'falhou')),
	CONSTRAINT "customer_messages_kind_check" CHECK ("customer_messages"."kind" in ('convite_mesa', 'reativacao', 'lembrete'))
);
--> statement-breakpoint
CREATE TABLE "digest_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waiter_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "waiter_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "weekly_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"week_key" text NOT NULL,
	"status" text NOT NULL,
	"plan_id" uuid,
	"reserved_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"via" text NOT NULL,
	CONSTRAINT "weekly_digests_status_check" CHECK ("weekly_digests"."status" in ('reservado', 'enviado', 'falhou'))
);
--> statement-breakpoint
ALTER TABLE "customer_contacts" DROP CONSTRAINT "customer_contacts_phone_hmac_unique";--> statement-breakpoint
ALTER TABLE "kit_pieces" DROP CONSTRAINT "kit_pieces_kind_check";--> statement-breakpoint
ALTER TABLE "customer_contacts" ALTER COLUMN "phone_hmac" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_contacts" ALTER COLUMN "phone_last4" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_contacts" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "email_enc" text;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD COLUMN "email_hmac" text;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD COLUMN "email_enc" text;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD COLUMN "email_hint" text;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "restaurant_customers" ADD COLUMN "opt_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_plans" ADD COLUMN "agent_steps" jsonb;--> statement-breakpoint
ALTER TABLE "customer_login_codes" ADD CONSTRAINT "customer_login_codes_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_simulation_run_id_simulation_runs_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_tokens" ADD CONSTRAINT "digest_tokens_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_tokens" ADD CONSTRAINT "digest_tokens_plan_id_weekly_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiter_tokens" ADD CONSTRAINT "waiter_tokens_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_digests" ADD CONSTRAINT "weekly_digests_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_digests" ADD CONSTRAINT "weekly_digests_plan_id_weekly_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_login_codes_email_idx" ON "customer_login_codes" USING btree ("email_hmac","created_at");--> statement-breakpoint
CREATE INDEX "customer_messages_customer_idx" ON "customer_messages" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_messages_pending_idx" ON "customer_messages" USING btree ("restaurant_id") WHERE email_status = 'pendente';--> statement-breakpoint
CREATE UNIQUE INDEX "customer_messages_invite_uq" ON "customer_messages" USING btree ("invite_id","kind");--> statement-breakpoint
CREATE INDEX "waiter_tokens_restaurant_idx" ON "waiter_tokens" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_digests_week_uq" ON "weekly_digests" USING btree ("restaurant_id","week_key");--> statement-breakpoint
CREATE INDEX "customer_contacts_phone_idx" ON "customer_contacts" USING btree ("phone_hmac");--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_email_hmac_unique" UNIQUE("email_hmac");--> statement-breakpoint
ALTER TABLE "kit_pieces" ADD CONSTRAINT "kit_pieces_kind_check" CHECK ("kit_pieces"."kind" in ('display', 'cartaz', 'garcom', 'porta_conta'));--> statement-breakpoint
-- S4 (D152, revisão técnica B4): dados já em produção deixam de se apresentar como fictícios/teste.
UPDATE "restaurants" SET "description" = 'Cantina de bairro com massas frescas, pizzas de fermentação longa e sobremesas da casa.', "address" = 'Rua Nonna Lucia, 120 – São Paulo – SP' WHERE "address" = 'Rua das Laranjeiras Fictícias, 120 – Vila Exemplo, São Paulo – SP';--> statement-breakpoint
UPDATE "restaurants" SET "address" = NULL WHERE "address" = 'Rua Exemplo Fictícia, 100 – São Paulo – SP';--> statement-breakpoint
UPDATE "customer_contacts" SET "name" = regexp_replace("name", ' Fictício$', ' Souza') WHERE "name" LIKE '% Fictício';--> statement-breakpoint
UPDATE "customer_contacts" SET "name" = regexp_replace("name", ' Exemplo$', ' Lima') WHERE "name" LIKE '% Exemplo';--> statement-breakpoint
UPDATE "customer_contacts" SET "name" = regexp_replace("name", ' Teste$', ' Costa') WHERE "name" LIKE '% Teste';--> statement-breakpoint
UPDATE "customer_contacts" SET "name" = regexp_replace("name", ' Demonstração$', ' Rocha') WHERE "name" LIKE '% Demonstração';--> statement-breakpoint
UPDATE "customer_contacts" SET "name" = regexp_replace("name", ' Protótipo$', ' Alves') WHERE "name" LIKE '% Protótipo';--> statement-breakpoint
UPDATE "customer_contacts" SET "name" = regexp_replace("name", ' Simulado$', ' Martins') WHERE "name" LIKE '% Simulado';
--> statement-breakpoint
-- S4 (revisão técnica B2): o e-mail segue o opt-in do app nas linhas existentes (simulador grava os dois iguais).
UPDATE "restaurant_customers" SET "opt_email" = "opt_app";
--> statement-breakpoint
-- S4: o veredito "trocar" dos planos já gravados não fala em "testar" (texto de produto, não de protótipo).
UPDATE "weekly_plans" SET "learned" = replace("learned"::text, 'vale testar outra oferta', 'vale trocar a oferta')::jsonb WHERE "learned"::text LIKE '%vale testar outra oferta%';
