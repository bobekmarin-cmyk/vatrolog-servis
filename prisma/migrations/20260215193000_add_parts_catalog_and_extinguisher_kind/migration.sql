-- 1) Extend AgentType with OTHER (medium = ostalo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'AgentType' AND e.enumlabel = 'OTHER'
  ) THEN
    ALTER TYPE "AgentType" ADD VALUE 'OTHER';
  END IF;
END $$;

-- 2) New enum: ExtinguisherKind (P/S/CO2/OTHER)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExtinguisherKind') THEN
    CREATE TYPE "ExtinguisherKind" AS ENUM ('P', 'S', 'CO2', 'OTHER');
  END IF;
END $$;

-- 3) Add kind to ExtinguisherType and backfill for existing rows
ALTER TABLE "ExtinguisherType" ADD COLUMN IF NOT EXISTS "kind" "ExtinguisherKind";

UPDATE "ExtinguisherType"
SET "kind" = 'CO2'
WHERE "kind" IS NULL AND ("agent" = 'CO2' OR "code" ILIKE 'CO2%');

UPDATE "ExtinguisherType"
SET "kind" = 'P'
WHERE "kind" IS NULL AND "code" ILIKE 'P%';

UPDATE "ExtinguisherType"
SET "kind" = 'S'
WHERE "kind" IS NULL AND "code" ILIKE 'S%';

UPDATE "ExtinguisherType"
SET "kind" = 'OTHER'
WHERE "kind" IS NULL;

ALTER TABLE "ExtinguisherType" ALTER COLUMN "kind" SET NOT NULL;

-- 4) Parts catalog (platform-level)
CREATE TABLE IF NOT EXISTS "Part" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "common" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Part_name_key" ON "Part"("name");

CREATE TABLE IF NOT EXISTS "PartKind" (
  "partId" TEXT NOT NULL,
  "kind" "ExtinguisherKind" NOT NULL,
  CONSTRAINT "PartKind_pkey" PRIMARY KEY ("partId", "kind")
);

CREATE INDEX IF NOT EXISTS "PartKind_kind_idx" ON "PartKind"("kind");

ALTER TABLE "PartKind"
ADD CONSTRAINT "PartKind_partId_fkey"
FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

