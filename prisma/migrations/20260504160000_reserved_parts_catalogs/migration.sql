-- =====================================================================
-- Reserved Parts Catalogs
--
-- 1) Part dobiva `manufacturerCode` (službena šifra proizvođača).
-- 2) Novi modeli:
--    - CompanyPartCatalogSetting (toggle uključenosti platform kataloga)
--    - CompanyPartOverride (tenantova šifra/cijena/aktivacija za platform dio)
-- 3) WorkOrderItemPart dobiva snapshot polja (code/manufacturerCode/name/source).
-- 4) Backfill:
--    - postojeći Part.code za platform dijelove kopiramo u manufacturerCode
--    - postojeći WorkOrderItemPart popunjavamo snapshot vrijednostima iz Part-a
-- =====================================================================

-- AlterTable
ALTER TABLE "Part" ADD COLUMN "manufacturerCode" TEXT;

-- Backfill: kod platform dijelova preuzmi postojeći Part.code u manufacturerCode.
UPDATE "Part"
SET "manufacturerCode" = "code"
WHERE "companyId" IS NULL
  AND ("manufacturerCode" IS NULL OR "manufacturerCode" = '');

-- AlterTable
ALTER TABLE "WorkOrderItemPart"
  ADD COLUMN "snapshotCode" TEXT,
  ADD COLUMN "snapshotManufacturerCode" TEXT,
  ADD COLUMN "snapshotName" TEXT,
  ADD COLUMN "snapshotIsCustom" BOOLEAN;

-- Backfill snapshot polja iz trenutnih Part zapisa, da povijesni servisi ostanu
-- prikazivi i nakon kasnijih izmjena u katalogu.
UPDATE "WorkOrderItemPart" AS wip
SET
  "snapshotCode" = COALESCE(wip."snapshotCode", p."code"),
  "snapshotManufacturerCode" = COALESCE(wip."snapshotManufacturerCode", p."manufacturerCode"),
  "snapshotName" = COALESCE(wip."snapshotName", p."name"),
  "snapshotIsCustom" = COALESCE(wip."snapshotIsCustom", p."companyId" IS NOT NULL)
FROM "Part" AS p
WHERE wip."partId" = p."id";

-- CreateTable
CREATE TABLE "CompanyPartCatalogSetting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "usePlatformCatalog" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPartCatalogSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyPartCatalogSetting_companyId_idx" ON "CompanyPartCatalogSetting"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPartCatalogSetting_companyId_manufacturerId_key" ON "CompanyPartCatalogSetting"("companyId", "manufacturerId");

-- AddForeignKey
ALTER TABLE "CompanyPartCatalogSetting" ADD CONSTRAINT "CompanyPartCatalogSetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPartCatalogSetting" ADD CONSTRAINT "CompanyPartCatalogSetting_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CompanyPartOverride" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "code" TEXT,
    "price" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPartOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyPartOverride_companyId_idx" ON "CompanyPartOverride"("companyId");

-- CreateIndex
CREATE INDEX "CompanyPartOverride_partId_idx" ON "CompanyPartOverride"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPartOverride_companyId_partId_key" ON "CompanyPartOverride"("companyId", "partId");

-- AddForeignKey
ALTER TABLE "CompanyPartOverride" ADD CONSTRAINT "CompanyPartOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPartOverride" ADD CONSTRAINT "CompanyPartOverride_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
