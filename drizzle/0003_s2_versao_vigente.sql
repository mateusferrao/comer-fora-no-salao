-- Revisão da S2: se alguma corrida antiga deixou duas versões vigentes, mantém só a de maior número.
UPDATE "benefit_versions" bv SET "superseded_at" = bv."valid_from"
WHERE bv."superseded_at" IS NULL
  AND EXISTS (SELECT 1 FROM "benefit_versions" o WHERE o."benefit_id" = bv."benefit_id" AND o."superseded_at" IS NULL AND o."version" > bv."version");--> statement-breakpoint
CREATE UNIQUE INDEX "benefit_versions_vigente_uq" ON "benefit_versions" USING btree ("benefit_id") WHERE "benefit_versions"."superseded_at" is null;
