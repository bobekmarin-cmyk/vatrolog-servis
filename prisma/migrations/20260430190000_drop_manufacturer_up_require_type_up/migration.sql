-- Drop UP (unutarnji pregled) rules from Manufacturer.
-- UP is now defined exclusively per ExtinguisherType.
-- Existing types with NULL rules are backfilled to FIXED 4 god (matches the
-- previous hardcoded fallback in src/lib/internalUpRule.ts).

-- 1) Backfill: types without an explicit rule get FIXED 4 god.
UPDATE "ExtinguisherType"
SET "internalRuleMode" = 'FIXED',
    "internalIntervalYears" = COALESCE("internalIntervalYears", 4)
WHERE "internalRuleMode" IS NULL;

-- 2) NOT NULL + defaults on ExtinguisherType.
ALTER TABLE "ExtinguisherType"
  ALTER COLUMN "internalRuleMode" SET NOT NULL,
  ALTER COLUMN "internalRuleMode" SET DEFAULT 'FIXED',
  ALTER COLUMN "internalIntervalYears" SET NOT NULL,
  ALTER COLUMN "internalIntervalYears" SET DEFAULT 4;

-- 3) Drop UP columns from Manufacturer.
ALTER TABLE "Manufacturer"
  DROP COLUMN "internalRuleMode",
  DROP COLUMN "internalIntervalYears",
  DROP COLUMN "internalOldThresholdYears",
  DROP COLUMN "internalOldIntervalYears",
  DROP COLUMN "internalYoungIntervalYears";
