-- AlterTable
ALTER TABLE "Manufacturer" ADD COLUMN IF NOT EXISTS "oib" TEXT;
ALTER TABLE "Manufacturer" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Manufacturer" ADD COLUMN IF NOT EXISTS "contactPerson" TEXT;
ALTER TABLE "Manufacturer" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
