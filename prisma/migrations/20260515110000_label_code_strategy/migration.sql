-- LabelCodeStrategy enum + Company stupci koji odlucuju kako se sifre naljepnica
-- unose za tu tvrtku (SHARED = jedan set za sve proizvodjace, PER_MANUFACTURER
-- = svaki proizvodjac vlastiti). U SHARED modu sifre se cuvaju direktno na
-- Company, a u PER_MANUFACTURER modu u CompanyManufacturerAuthorization.

CREATE TYPE "LabelCodeStrategy" AS ENUM ('SHARED', 'PER_MANUFACTURER');

ALTER TABLE "Company"
  ADD COLUMN "labelCodeStrategy" "LabelCodeStrategy" NOT NULL DEFAULT 'SHARED';

ALTER TABLE "Company"
  ADD COLUMN "sharedPeriodicLabelCode" TEXT;

ALTER TABLE "Company"
  ADD COLUMN "sharedApparatusMassLabelCode" TEXT;

ALTER TABLE "Company"
  ADD COLUMN "sharedCylinderMassLabelCode" TEXT;

-- Backfill: ako tvrtka vec ima razlicite sifre po proizvodjacu u
-- CompanyManufacturerAuthorization, postavi strategiju na PER_MANUFACTURER
-- kako se postojece postavke ne bi izgubile.
UPDATE "Company" c
SET "labelCodeStrategy" = 'PER_MANUFACTURER'
WHERE EXISTS (
  SELECT 1
  FROM "CompanyManufacturerAuthorization" a
  WHERE a."companyId" = c."id"
    AND (
      a."periodicLabelCode" IS NOT NULL
      OR a."apparatusMassLabelCode" IS NOT NULL
      OR a."cylinderMassLabelCode" IS NOT NULL
    )
);
