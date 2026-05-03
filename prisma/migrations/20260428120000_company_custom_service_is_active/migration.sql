-- Add isActive flag to CompanyCustomService for activate/deactivate UI toggle.
ALTER TABLE "CompanyCustomService"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
