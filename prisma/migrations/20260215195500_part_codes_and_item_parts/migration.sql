-- 1) Add required Part.code (unique), backfill existing
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "code" TEXT;

-- Backfill codes for existing rows (stable sequence)
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
  FROM "Part"
  WHERE ("code" IS NULL OR BTRIM("code") = '')
)
UPDATE "Part" p
SET "code" = 'D-' || LPAD(numbered.rn::text, 4, '0')
FROM numbered
WHERE p."id" = numbered."id";

-- If any still NULL (shouldn't happen), set fallback
UPDATE "Part" SET "code" = 'D-0000' WHERE "code" IS NULL OR BTRIM("code") = '';

ALTER TABLE "Part" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Part_code_key" ON "Part"("code");

-- 2) Structured parts usage on WorkOrderItem
CREATE TABLE IF NOT EXISTS "WorkOrderItemPart" (
  "companyId" TEXT NOT NULL,
  "workOrderItemId" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkOrderItemPart_pkey" PRIMARY KEY ("workOrderItemId", "partId")
);

CREATE INDEX IF NOT EXISTS "WorkOrderItemPart_companyId_idx" ON "WorkOrderItemPart"("companyId");
CREATE INDEX IF NOT EXISTS "WorkOrderItemPart_partId_idx" ON "WorkOrderItemPart"("partId");

ALTER TABLE "WorkOrderItemPart"
ADD CONSTRAINT "WorkOrderItemPart_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkOrderItemPart"
ADD CONSTRAINT "WorkOrderItemPart_workOrderItemId_fkey"
FOREIGN KEY ("workOrderItemId") REFERENCES "WorkOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkOrderItemPart"
ADD CONSTRAINT "WorkOrderItemPart_partId_fkey"
FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

