-- Merge Receipts into WorkOrders
-- 1) Wipe all relevant data first so DDL can succeed
DELETE FROM "WorkOrderItemPart";
DELETE FROM "WorkOrderItem";
DELETE FROM "DocumentLog";
DELETE FROM "ReceiptAddendum";
DELETE FROM "Receipt";
DELETE FROM "WorkOrder";

-- 2) Drop old tables
DROP TABLE IF EXISTS "ReceiptAddendum" CASCADE;
DROP TABLE IF EXISTS "Receipt" CASCADE;

-- 3) Drop unused enum ReceiptStatus (still used nowhere after Receipt removal)
DROP TYPE IF EXISTS "ReceiptStatus";

-- 4) Extend WorkOrder with deliveryMode and make receivedAt/receivedQty NOT NULL
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "deliveryMode" "ReceiptDeliveryMode" NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "WorkOrder" ALTER COLUMN "deliveryMode" DROP DEFAULT;

-- receivedAt may be nullable currently; table is empty so safe to enforce NOT NULL
ALTER TABLE "WorkOrder" ALTER COLUMN "receivedAt" SET NOT NULL;

-- receivedQty was nullable; make NOT NULL with default 0
ALTER TABLE "WorkOrder" ALTER COLUMN "receivedQty" SET DEFAULT 0;
UPDATE "WorkOrder" SET "receivedQty" = 0 WHERE "receivedQty" IS NULL;
ALTER TABLE "WorkOrder" ALTER COLUMN "receivedQty" SET NOT NULL;

-- 5) Ensure new index
CREATE INDEX IF NOT EXISTS "WorkOrder_companyId_receivedAt_idx" ON "WorkOrder"("companyId", "receivedAt");
