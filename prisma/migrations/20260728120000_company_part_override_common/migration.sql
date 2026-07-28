-- Tenant može overrideati platform „uobičajen“ (Part.common) za brzi izbornik dijelova.
-- NULL = naslijedi Part.common; TRUE/FALSE = eksplicitni tenantov izbor.
ALTER TABLE "CompanyPartOverride" ADD COLUMN "common" BOOLEAN;
