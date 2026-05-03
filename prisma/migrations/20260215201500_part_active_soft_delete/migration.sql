ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- Backfill for safety (in case DB ignores default on existing rows)
UPDATE "Part" SET "active" = true WHERE "active" IS NULL;

