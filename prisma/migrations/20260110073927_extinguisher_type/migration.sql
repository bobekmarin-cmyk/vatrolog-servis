/*
  Warnings:

  - Added the required column `extinguisherTypeId` to the `Extinguisher` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('PRAH', 'PJENA', 'CO2');

-- CreateEnum
CREATE TYPE "CapacityUnit" AS ENUM ('KG', 'L');

-- AlterTable
ALTER TABLE "Extinguisher" ADD COLUMN     "extinguisherTypeId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ExtinguisherType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agent" "AgentType" NOT NULL,
    "capacity" INTEGER,
    "capacityUnit" "CapacityUnit",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtinguisherType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtinguisherType_code_agent_key" ON "ExtinguisherType"("code", "agent");

-- AddForeignKey
ALTER TABLE "Extinguisher" ADD CONSTRAINT "Extinguisher_extinguisherTypeId_fkey" FOREIGN KEY ("extinguisherTypeId") REFERENCES "ExtinguisherType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
