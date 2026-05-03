-- Optional manufacturer-specific type descriptor on extinguisher

ALTER TABLE "Extinguisher"
  ADD COLUMN IF NOT EXISTS "typeDescription" TEXT;

