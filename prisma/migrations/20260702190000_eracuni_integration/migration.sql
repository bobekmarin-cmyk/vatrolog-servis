-- e-računi integracija: postavke po tvrtki, veza radni nalog ↔ račun, rabati kupca

-- CreateEnum
CREATE TYPE "WorkOrderInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'ERROR');

-- AlterTable: rabati po kategorijama na kupcu
ALTER TABLE "Customer"
  ADD COLUMN "discountServicesPct" DECIMAL(5,2),
  ADD COLUMN "discountLabelsPct" DECIMAL(5,2),
  ADD COLUMN "discountPartsPct" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "CompanyERacuniSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiUsername" TEXT,
    "apiPasswordEnc" TEXT,
    "apiTokenEnc" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'bankTransfer',
    "paymentDueDays" INTEGER NOT NULL DEFAULT 15,
    "labelKompletCode" TEXT,
    "labelKompletName" TEXT NOT NULL DEFAULT 'Komplet naljepnica',
    "labelKompletPrice" DECIMAL(10,2),
    "lastTestOkAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyERacuniSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "status" "WorkOrderInvoiceStatus" NOT NULL,
    "eracuniDocumentId" TEXT,
    "number" TEXT,
    "errorMessage" TEXT,
    "pdfStoragePath" TEXT,
    "createdByAccountUserId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyERacuniSettings_companyId_key" ON "CompanyERacuniSettings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderInvoice_workOrderId_key" ON "WorkOrderInvoice"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderInvoice_companyId_status_idx" ON "WorkOrderInvoice"("companyId", "status");

-- AddForeignKey
ALTER TABLE "CompanyERacuniSettings" ADD CONSTRAINT "CompanyERacuniSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderInvoice" ADD CONSTRAINT "WorkOrderInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderInvoice" ADD CONSTRAINT "WorkOrderInvoice_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
