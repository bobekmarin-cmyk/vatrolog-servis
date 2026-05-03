-- Backfill ManufacturerExtinguisherType from existing Extinguisher rows
-- If extinguishers already exist, supportedTypes should reflect their distinct pairs.

INSERT INTO "ManufacturerExtinguisherType" ("manufacturerId", "extinguisherTypeId")
SELECT DISTINCT e."manufacturerId", e."extinguisherTypeId"
FROM "Extinguisher" e
WHERE e."manufacturerId" IS NOT NULL
  AND e."extinguisherTypeId" IS NOT NULL
ON CONFLICT ("manufacturerId", "extinguisherTypeId") DO NOTHING;

