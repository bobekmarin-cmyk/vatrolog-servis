-- CreateEnum
CREATE TYPE "PartUnit" AS ENUM ('KOM', 'KG', 'L');

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "unit" "PartUnit" NOT NULL DEFAULT 'KOM';

-- AlterTable
ALTER TABLE "WorkOrderItemPart" ADD COLUMN     "snapshotUnit" "PartUnit";
