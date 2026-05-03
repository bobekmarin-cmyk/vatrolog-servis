/*
  Warnings:

  - You are about to drop the column `targetInternalMonth` on the `WorkOrderItem` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "WorkOrderItem_targetInternalMonth_idx";

-- AlterTable
ALTER TABLE "WorkOrderItem" DROP COLUMN "targetInternalMonth";
