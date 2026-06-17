-- AlterEnum
ALTER TYPE "AuthTokenType" ADD VALUE 'OWNER_INVITE';
ALTER TYPE "AuthTokenType" ADD VALUE 'OWNER_PASSWORD_RESET';
ALTER TYPE "AuthTokenType" ADD VALUE 'OWNER_EMAIL_VERIFY';

-- CreateEnum
CREATE TYPE "OwnerLinkStatus" AS ENUM ('PENDING_INVITE', 'ACTIVE', 'DECLINED', 'REVOKED');

-- AlterTable
ALTER TABLE "AuthToken" ADD COLUMN "ownerId" TEXT;

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "sessionsValidAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerCustomerLink" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OwnerLinkStatus" NOT NULL DEFAULT 'PENDING_INVITE',
    "invitedEmail" TEXT NOT NULL,
    "invitedByAccountUserId" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerCustomerLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Owner_email_key" ON "Owner"("email");

-- CreateIndex
CREATE INDEX "Owner_email_idx" ON "Owner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerCustomerLink_customerId_key" ON "OwnerCustomerLink"("customerId");

-- CreateIndex
CREATE INDEX "OwnerCustomerLink_ownerId_idx" ON "OwnerCustomerLink"("ownerId");

-- CreateIndex
CREATE INDEX "OwnerCustomerLink_companyId_status_idx" ON "OwnerCustomerLink"("companyId", "status");

-- CreateIndex
CREATE INDEX "OwnerCustomerLink_invitedEmail_idx" ON "OwnerCustomerLink"("invitedEmail");

-- CreateIndex
CREATE INDEX "AuthToken_ownerId_idx" ON "AuthToken"("ownerId");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerCustomerLink" ADD CONSTRAINT "OwnerCustomerLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerCustomerLink" ADD CONSTRAINT "OwnerCustomerLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerCustomerLink" ADD CONSTRAINT "OwnerCustomerLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerCustomerLink" ADD CONSTRAINT "OwnerCustomerLink_invitedByAccountUserId_fkey" FOREIGN KEY ("invitedByAccountUserId") REFERENCES "AccountUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
