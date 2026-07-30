-- CreateTable
CREATE TABLE "WorkOrderReceiptBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "qty" INTEGER NOT NULL,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderReceiptBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderPrimkaIssue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentKey" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfStoragePath" TEXT,
    "filename" TEXT,

    CONSTRAINT "WorkOrderPrimkaIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrderReceiptBatch_workOrderId_receivedAt_idx" ON "WorkOrderReceiptBatch"("workOrderId", "receivedAt");

-- CreateIndex
CREATE INDEX "WorkOrderReceiptBatch_companyId_idx" ON "WorkOrderReceiptBatch"("companyId");

-- CreateIndex
CREATE INDEX "WorkOrderPrimkaIssue_workOrderId_issuedAt_idx" ON "WorkOrderPrimkaIssue"("workOrderId", "issuedAt");

-- CreateIndex
CREATE INDEX "WorkOrderPrimkaIssue_companyId_idx" ON "WorkOrderPrimkaIssue"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderPrimkaIssue_workOrderId_version_key" ON "WorkOrderPrimkaIssue"("workOrderId", "version");

-- AddForeignKey
ALTER TABLE "WorkOrderReceiptBatch" ADD CONSTRAINT "WorkOrderReceiptBatch_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPrimkaIssue" ADD CONSTRAINT "WorkOrderPrimkaIssue_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: jedan početni batch po postojećem nalogu s receivedQty > 0
INSERT INTO "WorkOrderReceiptBatch" ("id", "companyId", "workOrderId", "receivedAt", "qty", "isInitial", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  wo."companyId",
  wo.id,
  wo."receivedAt",
  wo."receivedQty",
  true,
  NOW(),
  NOW()
FROM "WorkOrder" wo
WHERE wo."receivedQty" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "WorkOrderReceiptBatch" b WHERE b."workOrderId" = wo.id
  );
