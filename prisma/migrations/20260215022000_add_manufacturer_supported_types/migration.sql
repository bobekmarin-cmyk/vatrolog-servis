-- Manufacturer ↔ ExtinguisherType mapping (supported types per manufacturer)

CREATE TABLE IF NOT EXISTS "ManufacturerExtinguisherType" (
  "manufacturerId" TEXT NOT NULL,
  "extinguisherTypeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManufacturerExtinguisherType_pkey" PRIMARY KEY ("manufacturerId","extinguisherTypeId")
);

CREATE INDEX IF NOT EXISTS "ManufacturerExtinguisherType_extinguisherTypeId_idx"
  ON "ManufacturerExtinguisherType"("extinguisherTypeId");

ALTER TABLE "ManufacturerExtinguisherType"
  ADD CONSTRAINT "ManufacturerExtinguisherType_manufacturerId_fkey"
  FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManufacturerExtinguisherType"
  ADD CONSTRAINT "ManufacturerExtinguisherType_extinguisherTypeId_fkey"
  FOREIGN KEY ("extinguisherTypeId") REFERENCES "ExtinguisherType"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

