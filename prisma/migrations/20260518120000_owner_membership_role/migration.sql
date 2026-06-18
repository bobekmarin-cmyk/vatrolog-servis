-- CreateEnum
CREATE TYPE "OwnerMembershipRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "OwnerOrgMembership"
  ADD COLUMN "role" "OwnerMembershipRole" NOT NULL DEFAULT 'MEMBER',
  ADD COLUMN "invitedByOwnerId" TEXT;

-- Postojeći računi su ih kreirali serviseri → tretiramo ih kao administratore tvrtke.
UPDATE "OwnerOrgMembership" SET "role" = 'ADMIN';
