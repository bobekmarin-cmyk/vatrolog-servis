-- CreateEnum
CREATE TYPE "OwnerMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "OwnerOrgMembership" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerOrgId" TEXT NOT NULL,
    "status" "OwnerMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedEmail" TEXT NOT NULL,
    "invitedByAccountUserId" TEXT,
    "invitedByCompanyId" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastAccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerOrgMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerOrgMembership_ownerId_ownerOrgId_key" ON "OwnerOrgMembership"("ownerId", "ownerOrgId");

-- CreateIndex
CREATE INDEX "OwnerOrgMembership_ownerOrgId_idx" ON "OwnerOrgMembership"("ownerOrgId");

-- CreateIndex
CREATE INDEX "OwnerOrgMembership_invitedEmail_idx" ON "OwnerOrgMembership"("invitedEmail");

-- AddForeignKey
ALTER TABLE "OwnerOrgMembership" ADD CONSTRAINT "OwnerOrgMembership_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerOrgMembership" ADD CONSTRAINT "OwnerOrgMembership_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "OwnerOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- BACKFILL: membership iz postojećeg Owner.ownerOrgId
-- ============================================================
INSERT INTO "OwnerOrgMembership" ("id", "ownerId", "ownerOrgId", "status", "invitedEmail", "acceptedAt", "lastAccessAt", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || ow."id"),
       ow."id", ow."ownerOrgId", 'ACTIVE', ow."email", ow."createdAt", ow."lastLoginAt", now(), now()
FROM "Owner" ow
WHERE ow."ownerOrgId" IS NOT NULL
ON CONFLICT ("ownerId", "ownerOrgId") DO NOTHING;

-- ============================================================
-- Ukloni javni Customer portal (zamijenjen Korisničkim portalom)
-- ============================================================
DROP INDEX IF EXISTS "Customer_portalSecret_key";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "portalSecret";
