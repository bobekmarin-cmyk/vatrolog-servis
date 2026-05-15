-- AlterTable
ALTER TABLE "Company" ADD COLUMN "deliveryNoteNumberPrefix" VARCHAR(4);

-- CreateTable
CREATE TABLE "DeliveryNoteYearCounter" (
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DeliveryNoteYearCounter_pkey" PRIMARY KEY ("companyId","year")
);

-- CreateTable
CREATE TABLE "DeliveryNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedByAccountUserId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "pdfStoragePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryNote_companyId_number_key" ON "DeliveryNote"("companyId", "number");

-- CreateIndex
CREATE INDEX "DeliveryNote_companyId_issuedAt_idx" ON "DeliveryNote"("companyId", "issuedAt");

-- CreateIndex
CREATE INDEX "DeliveryNote_workOrderId_idx" ON "DeliveryNote"("workOrderId");

-- CreateIndex
CREATE INDEX "DeliveryNote_companyId_workOrderId_supersededAt_idx" ON "DeliveryNote"("companyId", "workOrderId", "supersededAt");

-- AddForeignKey
ALTER TABLE "DeliveryNoteYearCounter" ADD CONSTRAINT "DeliveryNoteYearCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_issuedByAccountUserId_fkey" FOREIGN KEY ("issuedByAccountUserId") REFERENCES "AccountUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
