-- Tenant scoping (multi-tenant) + Company service code
-- Strategy: add nullable columns -> backfill -> set NOT NULL -> add constraints/indexes.

-- 1) Company.serviceCode
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "serviceCode" TEXT;

-- Backfill: prefer a readable default for company_default, fallback to stable hash for others
UPDATE "Company"
SET "serviceCode" = '4201'
WHERE "id" = 'company_default' AND ("serviceCode" IS NULL OR "serviceCode" = '');

UPDATE "Company"
SET "serviceCode" = substring(md5("id") for 8)
WHERE ("serviceCode" IS NULL OR "serviceCode" = '');

ALTER TABLE "Company" ALTER COLUMN "serviceCode" SET NOT NULL;

-- Unique (may fail if duplicates exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Company_serviceCode_key'
  ) THEN
    CREATE UNIQUE INDEX "Company_serviceCode_key" ON "Company"("serviceCode");
  END IF;
END$$;

-- 2) Customer.companyId + unique per company
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
UPDATE "Customer" SET "companyId" = 'company_default' WHERE "companyId" IS NULL;
ALTER TABLE "Customer" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Customer_oib_key";
CREATE INDEX IF NOT EXISTS "Customer_companyId_idx" ON "Customer"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_companyId_oib_key" ON "Customer"("companyId","oib");

-- 3) WorkOrder.companyId + unique per company
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
UPDATE "WorkOrder" SET "companyId" = 'company_default' WHERE "companyId" IS NULL;
ALTER TABLE "WorkOrder" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "WorkOrder_orderNumber_key";
CREATE INDEX IF NOT EXISTS "WorkOrder_companyId_createdAt_idx" ON "WorkOrder"("companyId","createdAt");
CREATE INDEX IF NOT EXISTS "WorkOrder_companyId_status_createdAt_idx" ON "WorkOrder"("companyId","status","createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrder_companyId_orderNumber_key" ON "WorkOrder"("companyId","orderNumber");

-- 4) Receipt.companyId + unique per company
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
UPDATE "Receipt" SET "companyId" = 'company_default' WHERE "companyId" IS NULL;
ALTER TABLE "Receipt" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Receipt"
  ADD CONSTRAINT "Receipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Receipt_receiptNumber_key";
CREATE INDEX IF NOT EXISTS "Receipt_companyId_receivedAt_idx" ON "Receipt"("companyId","receivedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_companyId_receiptNumber_key" ON "Receipt"("companyId","receiptNumber");

-- 5) Extinguisher.companyId + unique per company
ALTER TABLE "Extinguisher" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
UPDATE "Extinguisher" SET "companyId" = 'company_default' WHERE "companyId" IS NULL;
ALTER TABLE "Extinguisher" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Extinguisher"
  ADD CONSTRAINT "Extinguisher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Extinguisher_internalCode_key";
CREATE INDEX IF NOT EXISTS "Extinguisher_companyId_idx" ON "Extinguisher"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "Extinguisher_companyId_internalCode_key" ON "Extinguisher"("companyId","internalCode");

-- 6) WorkOrderItem.companyId + unique labelNumber per company
ALTER TABLE "WorkOrderItem" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- Backfill from WorkOrder
UPDATE "WorkOrderItem" wi
SET "companyId" = wo."companyId"
FROM "WorkOrder" wo
WHERE wi."companyId" IS NULL AND wi."workOrderId" = wo."id";

-- Fallback if any remain
UPDATE "WorkOrderItem" SET "companyId" = 'company_default' WHERE "companyId" IS NULL;

ALTER TABLE "WorkOrderItem" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "WorkOrderItem"
  ADD CONSTRAINT "WorkOrderItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "WorkOrderItem_labelNumber_key";
CREATE INDEX IF NOT EXISTS "WorkOrderItem_companyId_idx" ON "WorkOrderItem"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrderItem_companyId_labelNumber_key" ON "WorkOrderItem"("companyId","labelNumber");

-- 7) InternalCodeCounter.companyId + unique per company
ALTER TABLE "InternalCodeCounter" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
UPDATE "InternalCodeCounter" SET "companyId" = 'company_default' WHERE "companyId" IS NULL;
ALTER TABLE "InternalCodeCounter" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "InternalCodeCounter"
  ADD CONSTRAINT "InternalCodeCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "InternalCodeCounter_weightCode_key";
CREATE INDEX IF NOT EXISTS "InternalCodeCounter_companyId_idx" ON "InternalCodeCounter"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "InternalCodeCounter_companyId_weightCode_key" ON "InternalCodeCounter"("companyId","weightCode");

