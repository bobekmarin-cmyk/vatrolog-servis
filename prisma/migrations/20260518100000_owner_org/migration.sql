-- CreateTable
CREATE TABLE "OwnerOrg" (
    "id" TEXT NOT NULL,
    "oib" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerOrg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerOrg_oib_key" ON "OwnerOrg"("oib");

-- AlterTable
ALTER TABLE "Owner" ADD COLUMN "ownerOrgId" TEXT;

-- AlterTable
ALTER TABLE "OwnerCustomerLink" ADD COLUMN "ownerOrgId" TEXT,
    ADD COLUMN "hiddenByVendorAt" TIMESTAMP(3),
    ADD COLUMN "forcedByVendorAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RegularInspection" ADD COLUMN "ownerOrgId" TEXT;

-- CreateIndex
CREATE INDEX "Owner_ownerOrgId_idx" ON "Owner"("ownerOrgId");

-- CreateIndex
CREATE INDEX "OwnerCustomerLink_ownerOrgId_idx" ON "OwnerCustomerLink"("ownerOrgId");

-- CreateIndex
CREATE INDEX "RegularInspection_ownerOrgId_extinguisherId_inspectedAt_idx" ON "RegularInspection"("ownerOrgId", "extinguisherId", "inspectedAt");

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "OwnerOrg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerCustomerLink" ADD CONSTRAINT "OwnerCustomerLink_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "OwnerOrg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularInspection" ADD CONSTRAINT "RegularInspection_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "OwnerOrg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- BACKFILL: OwnerOrg po OIB-u + prevezivanje postojećih veza,
-- vlasnika i redovnih pregleda.
-- ============================================================

-- 1) Kreiraj OwnerOrg za svaki distinct OIB koji ima vezu s vlasnikom.
INSERT INTO "OwnerOrg" ("id", "oib", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || sub.oib), sub.oib, now(), now()
FROM (
    SELECT DISTINCT cu."oib" AS oib
    FROM "OwnerCustomerLink" l
    JOIN "Customer" cu ON cu."id" = l."customerId"
    WHERE cu."oib" IS NOT NULL AND cu."oib" <> ''
) sub
ON CONFLICT ("oib") DO NOTHING;

-- 2) Poveži svaku OwnerCustomerLink vezu s orgom po OIB-u kupca.
UPDATE "OwnerCustomerLink" l
SET "ownerOrgId" = o."id"
FROM "Customer" cu
JOIN "OwnerOrg" o ON o."oib" = cu."oib"
WHERE cu."id" = l."customerId" AND l."ownerOrgId" IS NULL;

-- 3) Poveži svaki Owner račun s orgom (iz njegovih veza).
UPDATE "Owner" ow
SET "ownerOrgId" = sub.org
FROM (
    SELECT DISTINCT ON (l."ownerId") l."ownerId" AS oid, l."ownerOrgId" AS org
    FROM "OwnerCustomerLink" l
    WHERE l."ownerId" IS NOT NULL AND l."ownerOrgId" IS NOT NULL
    ORDER BY l."ownerId", l."acceptedAt" ASC NULLS LAST
) sub
WHERE ow."id" = sub.oid AND ow."ownerOrgId" IS NULL;

-- 4) Poveži redovne preglede s orgom vlasnika.
UPDATE "RegularInspection" ri
SET "ownerOrgId" = ow."ownerOrgId"
FROM "Owner" ow
WHERE ow."id" = ri."ownerId" AND ow."ownerOrgId" IS NOT NULL AND ri."ownerOrgId" IS NULL;
