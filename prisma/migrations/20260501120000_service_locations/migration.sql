-- =============================================================================
-- SERVICE LOCATIONS + USERNAME SLUG + WORK ORDER LOCATION/CREATOR
-- =============================================================================

-- 1) Enum tipova servisne lokacije
CREATE TYPE "ServiceLocationKind" AS ENUM ('STATIONARY', 'VEHICLE');

-- 2) Company.usernameSlug (auto-derive iz name; backfill prije NOT NULL)
ALTER TABLE "Company" ADD COLUMN "usernameSlug" TEXT;

UPDATE "Company"
SET "usernameSlug" = COALESCE(
  NULLIF(
    SUBSTRING(LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]', '', 'g')) FROM 1 FOR 7),
    ''
  ),
  'tenant'
);

ALTER TABLE "Company" ALTER COLUMN "usernameSlug" SET NOT NULL;

-- 3) CompanyServiceLocation tablica
CREATE TABLE "CompanyServiceLocation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "kind" "ServiceLocationKind" NOT NULL,
  "label" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyServiceLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyServiceLocation_companyId_kind_ordinal_key"
  ON "CompanyServiceLocation"("companyId", "kind", "ordinal");

CREATE INDEX "CompanyServiceLocation_companyId_active_idx"
  ON "CompanyServiceLocation"("companyId", "active");

ALTER TABLE "CompanyServiceLocation"
  ADD CONSTRAINT "CompanyServiceLocation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) AccountUser.serviceLocationId
ALTER TABLE "AccountUser" ADD COLUMN "serviceLocationId" TEXT;

ALTER TABLE "AccountUser"
  ADD CONSTRAINT "AccountUser_serviceLocationId_fkey"
  FOREIGN KEY ("serviceLocationId") REFERENCES "CompanyServiceLocation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AccountUser_serviceLocationId_idx"
  ON "AccountUser"("serviceLocationId");

-- 5) WorkOrder dopune: nullable deliveryMode + serviceLocationId + createdByAccountUserId
ALTER TABLE "WorkOrder" ALTER COLUMN "deliveryMode" DROP NOT NULL;

ALTER TABLE "WorkOrder" ADD COLUMN "serviceLocationId" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN "createdByAccountUserId" TEXT;

ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_serviceLocationId_fkey"
  FOREIGN KEY ("serviceLocationId") REFERENCES "CompanyServiceLocation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_createdByAccountUserId_fkey"
  FOREIGN KEY ("createdByAccountUserId") REFERENCES "AccountUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WorkOrder_companyId_serviceLocationId_idx"
  ON "WorkOrder"("companyId", "serviceLocationId");

CREATE INDEX "WorkOrder_companyId_createdByAccountUserId_idx"
  ON "WorkOrder"("companyId", "createdByAccountUserId");
