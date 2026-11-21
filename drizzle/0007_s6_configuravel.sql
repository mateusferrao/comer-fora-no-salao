ALTER TABLE "restaurants" ADD COLUMN "notify_settings" jsonb;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "ai_about" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "ai_avoid" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "ai_features" jsonb;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD COLUMN "email_skip_reason" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "offer_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "restaurant_customers" ADD COLUMN "email_prefs" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "waiter_tokens_active_uq" ON "waiter_tokens" USING btree ("restaurant_id") WHERE revoked_at is null;