-- Redundante com plan_sends_plan_uq (revisão S3 #36).
DROP INDEX IF EXISTS "plan_sends_plan_idx";--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "advanced_at" timestamp with time zone;