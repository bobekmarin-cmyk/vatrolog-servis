-- AlterTable
ALTER TABLE "AccountUser" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "activeUntil" TIMESTAMP(3),
ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false;
