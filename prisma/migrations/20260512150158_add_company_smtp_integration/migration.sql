-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "mailProvider" TEXT,
ADD COLUMN     "smtpConnectedAt" TIMESTAMP(3),
ADD COLUMN     "smtpFromEmail" TEXT,
ADD COLUMN     "smtpFromName" TEXT,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPassEncrypted" TEXT,
ADD COLUMN     "smtpPort" INTEGER,
ADD COLUMN     "smtpSecure" BOOLEAN,
ADD COLUMN     "smtpUser" TEXT;
