/*
  Warnings:

  - A unique constraint covering the columns `[labelNumber]` on the table `WorkOrderItem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "WorkOrderItem" ADD COLUMN     "partsText" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderItem_labelNumber_key" ON "WorkOrderItem"("labelNumber");
