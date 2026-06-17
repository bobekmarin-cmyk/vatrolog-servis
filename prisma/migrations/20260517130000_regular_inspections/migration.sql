-- CreateEnum
CREATE TYPE "RegularInspectionResult" AS ENUM ('OK', 'ISSUES');

-- CreateTable
CREATE TABLE "RegularInspection" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "extinguisherId" TEXT NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessibilityOk" BOOLEAN NOT NULL,
    "markingsOk" BOOLEAN NOT NULL,
    "complete" BOOLEAN NOT NULL,
    "noDamage" BOOLEAN NOT NULL,
    "sealOk" BOOLEAN NOT NULL,
    "pressureGaugeOk" BOOLEAN,
    "result" "RegularInspectionResult" NOT NULL DEFAULT 'OK',
    "note" TEXT,
    "performedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegularInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegularInspection_ownerId_extinguisherId_inspectedAt_idx" ON "RegularInspection"("ownerId", "extinguisherId", "inspectedAt");

-- CreateIndex
CREATE INDEX "RegularInspection_companyId_idx" ON "RegularInspection"("companyId");

-- CreateIndex
CREATE INDEX "RegularInspection_extinguisherId_idx" ON "RegularInspection"("extinguisherId");

-- AddForeignKey
ALTER TABLE "RegularInspection" ADD CONSTRAINT "RegularInspection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularInspection" ADD CONSTRAINT "RegularInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularInspection" ADD CONSTRAINT "RegularInspection_extinguisherId_fkey" FOREIGN KEY ("extinguisherId") REFERENCES "Extinguisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
