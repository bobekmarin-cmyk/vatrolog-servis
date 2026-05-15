-- Dodaje email i Google `sub` mapiranje na PlatformUser radi Google OIDC prijave
-- za /platform. Postojeci redovi ostaju netaknuti — username/lozinka i dalje rade.

ALTER TABLE "PlatformUser" ADD COLUMN "email" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN "googleSub" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN "lastGoogleLoginAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");
CREATE UNIQUE INDEX "PlatformUser_googleSub_key" ON "PlatformUser"("googleSub");
