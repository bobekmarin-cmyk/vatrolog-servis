-- CreateEnum
CREATE TYPE "InternalRuleMode" AS ENUM ('FIXED', 'AGE_BASED');

-- AlterTable
ALTER TABLE "Extinguisher" ADD COLUMN     "lastInternalAt" TIMESTAMP(3),
ADD COLUMN     "lastPeriodicAt" TIMESTAMP(3),
ADD COLUMN     "nextInternalDue" TIMESTAMP(3),
ADD COLUMN     "nextPeriodicDue" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Manufacturer" ADD COLUMN     "internalIntervalYears" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "internalOldIntervalYears" INTEGER,
ADD COLUMN     "internalOldThresholdYears" INTEGER,
ADD COLUMN     "internalRuleMode" "InternalRuleMode" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "internalYoungIntervalYears" INTEGER;

-- AlterTable
ALTER TABLE "WorkOrderItem" ADD COLUMN     "internalDoneAt" TIMESTAMP(3);
