-- CreateEnum
CREATE TYPE "ServiceLabelKind" AS ENUM ('PERIODIC', 'APPARATUS_MASS', 'CYLINDER_MASS');

-- CreateTable
CREATE TABLE "ServiceLabel" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "kind" "ServiceLabelKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceLabel_manufacturerId_idx" ON "ServiceLabel"("manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLabel_manufacturerId_kind_key" ON "ServiceLabel"("manufacturerId", "kind");

-- AddForeignKey
ALTER TABLE "ServiceLabel"
    ADD CONSTRAINT "ServiceLabel_manufacturerId_fkey"
    FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CompanyManufacturerAuthorization" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "periodicLabelCode" TEXT,
    "apparatusMassLabelCode" TEXT,
    "cylinderMassLabelCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyManufacturerAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyManufacturerAuthorization_companyId_idx" ON "CompanyManufacturerAuthorization"("companyId");

-- CreateIndex
CREATE INDEX "CompanyManufacturerAuthorization_manufacturerId_idx" ON "CompanyManufacturerAuthorization"("manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyManufacturerAuthorization_companyId_manufacturerId_key" ON "CompanyManufacturerAuthorization"("companyId", "manufacturerId");

-- AddForeignKey
ALTER TABLE "CompanyManufacturerAuthorization"
    ADD CONSTRAINT "CompanyManufacturerAuthorization_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyManufacturerAuthorization"
    ADD CONSTRAINT "CompanyManufacturerAuthorization_manufacturerId_fkey"
    FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ServiceLabelStock" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceLabelId" TEXT NOT NULL,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "minStockQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceLabelStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceLabelStock_companyId_idx" ON "ServiceLabelStock"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLabelStock_companyId_serviceLabelId_key" ON "ServiceLabelStock"("companyId", "serviceLabelId");

-- AddForeignKey
ALTER TABLE "ServiceLabelStock"
    ADD CONSTRAINT "ServiceLabelStock_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLabelStock"
    ADD CONSTRAINT "ServiceLabelStock_serviceLabelId_fkey"
    FOREIGN KEY ("serviceLabelId") REFERENCES "ServiceLabel"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ServiceLabelReceipt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierName" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceLabelReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceLabelReceipt_companyId_receiptDate_idx" ON "ServiceLabelReceipt"("companyId", "receiptDate");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLabelReceipt_companyId_number_key" ON "ServiceLabelReceipt"("companyId", "number");

-- AddForeignKey
ALTER TABLE "ServiceLabelReceipt"
    ADD CONSTRAINT "ServiceLabelReceipt_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLabelReceipt"
    ADD CONSTRAINT "ServiceLabelReceipt_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "AccountUser"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ServiceLabelReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "serviceLabelId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ServiceLabelReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceLabelReceiptItem_receiptId_idx" ON "ServiceLabelReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "ServiceLabelReceiptItem_serviceLabelId_idx" ON "ServiceLabelReceiptItem"("serviceLabelId");

-- AddForeignKey
ALTER TABLE "ServiceLabelReceiptItem"
    ADD CONSTRAINT "ServiceLabelReceiptItem_receiptId_fkey"
    FOREIGN KEY ("receiptId") REFERENCES "ServiceLabelReceipt"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLabelReceiptItem"
    ADD CONSTRAINT "ServiceLabelReceiptItem_serviceLabelId_fkey"
    FOREIGN KEY ("serviceLabelId") REFERENCES "ServiceLabel"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ServiceLabelAdjustment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceLabelId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceLabelAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceLabelAdjustment_companyId_serviceLabelId_createdAt_idx" ON "ServiceLabelAdjustment"("companyId", "serviceLabelId", "createdAt");

-- AddForeignKey
ALTER TABLE "ServiceLabelAdjustment"
    ADD CONSTRAINT "ServiceLabelAdjustment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLabelAdjustment"
    ADD CONSTRAINT "ServiceLabelAdjustment_serviceLabelId_fkey"
    FOREIGN KEY ("serviceLabelId") REFERENCES "ServiceLabel"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLabelAdjustment"
    ADD CONSTRAINT "ServiceLabelAdjustment_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "AccountUser"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "WorkOrderLabelConsumption" (
    "workOrderId" TEXT NOT NULL,
    "serviceLabelId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderLabelConsumption_pkey" PRIMARY KEY ("workOrderId", "serviceLabelId")
);

-- CreateIndex
CREATE INDEX "WorkOrderLabelConsumption_workOrderId_idx" ON "WorkOrderLabelConsumption"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderLabelConsumption_serviceLabelId_idx" ON "WorkOrderLabelConsumption"("serviceLabelId");

-- AddForeignKey
ALTER TABLE "WorkOrderLabelConsumption"
    ADD CONSTRAINT "WorkOrderLabelConsumption_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderLabelConsumption"
    ADD CONSTRAINT "WorkOrderLabelConsumption_serviceLabelId_fkey"
    FOREIGN KEY ("serviceLabelId") REFERENCES "ServiceLabel"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Auto-seed 3 naljepnice (PERIODIC, APPARATUS_MASS, CYLINDER_MASS) za svakog postojećeg proizvođača.
INSERT INTO "ServiceLabel" ("id", "manufacturerId", "kind", "createdAt", "updatedAt")
SELECT
    'lbl_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
    m."id",
    k.kind::"ServiceLabelKind",
    NOW(),
    NOW()
FROM "Manufacturer" m
CROSS JOIN (VALUES ('PERIODIC'), ('APPARATUS_MASS'), ('CYLINDER_MASS')) AS k(kind)
ON CONFLICT ("manufacturerId", "kind") DO NOTHING;
