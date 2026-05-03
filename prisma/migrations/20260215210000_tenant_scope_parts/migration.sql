-- Tenant-scope parts: duplicate existing global parts per company,
-- remap WorkOrderItemPart, then enforce companyId + composite uniques.

-- 0) Drop global unique indexes on code/name BEFORE duplication
DROP INDEX IF EXISTS "Part_code_key";
DROP INDEX IF EXISTS "Part_name_key";

-- 1) Add companyId column (nullable for transition)
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- 2) Duplicate "global" parts (companyId IS NULL) for every company
-- Use deterministic TEXT ids to avoid needing UUID/CUID generators:
-- newPartId = 'p_' || md5(companyId || oldPartId)
INSERT INTO "Part" ("id", "companyId", "code", "name", "common", "active", "createdAt", "updatedAt")
SELECT
  ('p_' || md5(c."id" || p."id")) AS id,
  c."id" AS companyId,
  p."code",
  p."name",
  p."common",
  p."active",
  p."createdAt",
  p."updatedAt"
FROM "Company" c
JOIN "Part" p ON p."companyId" IS NULL
ON CONFLICT DO NOTHING;

-- 3) Duplicate PartKind for each duplicated part
INSERT INTO "PartKind" ("partId", "kind")
SELECT
  ('p_' || md5(c."id" || p."id")) AS partId,
  pk."kind"
FROM "Company" c
JOIN "Part" p ON p."companyId" IS NULL
JOIN "PartKind" pk ON pk."partId" = p."id"
ON CONFLICT DO NOTHING;

-- 4) Remap WorkOrderItemPart.partId from old global part to company-specific duplicate
UPDATE "WorkOrderItemPart" w
SET "partId" = ('p_' || md5(w."companyId" || w."partId"))
WHERE EXISTS (
  SELECT 1 FROM "Part" p WHERE p."id" = w."partId" AND p."companyId" IS NULL
);

-- 5) Delete old global PartKind + Part rows
DELETE FROM "PartKind" pk
WHERE EXISTS (
  SELECT 1 FROM "Part" p WHERE p."id" = pk."partId" AND p."companyId" IS NULL
);

DELETE FROM "Part" WHERE "companyId" IS NULL;

-- 6) Enforce NOT NULL and FK to Company
ALTER TABLE "Part" ALTER COLUMN "companyId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Part_companyId_fkey') THEN
    ALTER TABLE "Part"
    ADD CONSTRAINT "Part_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 7) Replace unique indexes: code/name are unique per company
DROP INDEX IF EXISTS "Part_code_key";
DROP INDEX IF EXISTS "Part_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Part_companyId_code_key" ON "Part"("companyId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "Part_companyId_name_key" ON "Part"("companyId", "name");

CREATE INDEX IF NOT EXISTS "Part_companyId_idx" ON "Part"("companyId");

