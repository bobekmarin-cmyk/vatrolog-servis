-- Manufacturer.displayName: kratki prikaz na svim user-facing dokumentima.
ALTER TABLE "Manufacturer" ADD COLUMN "displayName" TEXT;

-- ExtinguisherType: per-type pravila unutarnjeg pregleda (UP).
-- Sva polja su nullable: ako tip nema pravila postavljena, koristi se fallback
-- s razine proizvođača (`Manufacturer.internal*`).
ALTER TABLE "ExtinguisherType"
  ADD COLUMN "internalRuleMode"           "InternalRuleMode",
  ADD COLUMN "internalIntervalYears"      INTEGER,
  ADD COLUMN "internalOldThresholdYears"  INTEGER,
  ADD COLUMN "internalOldIntervalYears"   INTEGER,
  ADD COLUMN "internalYoungIntervalYears" INTEGER;
