-- PlatformIntegration: jedan red po provideru (npr. "GMAIL"), enkriptirani tokeni.
CREATE TABLE "PlatformIntegration" (
  "id"              TEXT PRIMARY KEY,
  "provider"        TEXT NOT NULL,
  "email"           TEXT,
  "accessTokenEnc"  TEXT,
  "refreshTokenEnc" TEXT,
  "scope"           TEXT,
  "expiresAt"       TIMESTAMP(3),
  "connectedAt"     TIMESTAMP(3),
  "connectedById"   TEXT,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "PlatformIntegration_provider_key" ON "PlatformIntegration"("provider");

-- PlatformSettings: singleton platformske postavke (branding overrides za sistemski mail).
CREATE TABLE "PlatformSettings" (
  "id"               TEXT PRIMARY KEY,
  "defaultFromName"  TEXT,
  "defaultFromEmail" TEXT,
  "signatureHtml"    TEXT,
  "logoUrl"          TEXT,
  "brandColor"       TEXT,
  "updatedAt"        TIMESTAMP(3) NOT NULL
);

-- EmailLog: pretvori u fleksibilan log (sistemski + customer).
ALTER TABLE "EmailLog" DROP CONSTRAINT IF EXISTS "EmailLog_companyId_fkey";
ALTER TABLE "EmailLog" DROP CONSTRAINT IF EXISTS "EmailLog_customerId_fkey";

ALTER TABLE "EmailLog"
  ALTER COLUMN "companyId"  DROP NOT NULL,
  ALTER COLUMN "customerId" DROP NOT NULL,
  ALTER COLUMN "month"      DROP NOT NULL,
  ALTER COLUMN "itemCount"  DROP NOT NULL;

ALTER TABLE "EmailLog"
  ADD COLUMN "accountUserId" TEXT,
  ADD COLUMN "kind"          TEXT NOT NULL DEFAULT 'CUSTOMER_NOTIFICATION',
  ADD COLUMN "transport"     TEXT,
  ADD COLUMN "messageId"     TEXT;

ALTER TABLE "EmailLog"
  ADD CONSTRAINT "EmailLog_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "EmailLog"
  ADD CONSTRAINT "EmailLog_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL;
ALTER TABLE "EmailLog"
  ADD CONSTRAINT "EmailLog_accountUserId_fkey"
  FOREIGN KEY ("accountUserId") REFERENCES "AccountUser"("id") ON DELETE SET NULL;

CREATE INDEX "EmailLog_accountUserId_idx" ON "EmailLog"("accountUserId");
CREATE INDEX "EmailLog_kind_sentAt_idx"   ON "EmailLog"("kind", "sentAt");
CREATE INDEX "EmailLog_sentAt_idx"        ON "EmailLog"("sentAt");
