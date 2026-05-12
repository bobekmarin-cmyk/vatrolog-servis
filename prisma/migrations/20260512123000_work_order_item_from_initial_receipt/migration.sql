-- AlterTable
ALTER TABLE "WorkOrderItem" ADD COLUMN "fromInitialReceipt" BOOLEAN NOT NULL DEFAULT true;

-- Heuristika za postojeće podatke: naknadno dodani placeholderi obično imaju createdAt znatno nakon naloga.
UPDATE "WorkOrderItem" AS wi
SET "fromInitialReceipt" = false
FROM "WorkOrder" AS wo
WHERE wi."workOrderId" = wo.id
  AND wi."isPlaceholder" = true
  AND wi."createdAt" > wo."createdAt" + INTERVAL '120 seconds';
