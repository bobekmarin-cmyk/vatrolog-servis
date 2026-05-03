-- DropIndex
DROP INDEX "Part_manufacturerId_code_key";

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PartStock" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Part_companyId_idx" ON "Part"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Part_manufacturerId_companyId_code_key" ON "Part"("manufacturerId", "companyId", "code");

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
