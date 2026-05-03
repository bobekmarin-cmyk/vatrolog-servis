-- DropForeignKey
ALTER TABLE "Part" DROP CONSTRAINT "Part_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PartKind" DROP CONSTRAINT "PartKind_partId_fkey";

-- DropIndex
DROP INDEX "ExtinguisherType_code_agent_key";

-- DropIndex
DROP INDEX "Part_companyId_code_key";

-- DropIndex
DROP INDEX "Part_companyId_idx";

-- DropIndex
DROP INDEX "Part_companyId_name_key";

-- AlterTable
ALTER TABLE "ExtinguisherType" DROP COLUMN "agent",
DROP COLUMN "kind",
ADD COLUMN     "agentId" TEXT NOT NULL,
ADD COLUMN     "constructionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Part" DROP COLUMN "companyId",
ADD COLUMN     "manufacturerId" TEXT NOT NULL;

-- DropTable
DROP TABLE "PartKind";

-- DropEnum
DROP TYPE "AgentType";

-- DropEnum
DROP TYPE "ExtinguisherKind";

-- CreateTable
CREATE TABLE "AgentType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "symbol" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Construction" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prefix" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Construction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartExtinguisherType" (
    "partId" TEXT NOT NULL,
    "extinguisherTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartExtinguisherType_pkey" PRIMARY KEY ("partId","extinguisherTypeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentType_code_key" ON "AgentType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Construction_code_key" ON "Construction"("code");

-- CreateIndex
CREATE INDEX "PartExtinguisherType_extinguisherTypeId_idx" ON "PartExtinguisherType"("extinguisherTypeId");

-- CreateIndex
CREATE INDEX "ExtinguisherType_agentId_idx" ON "ExtinguisherType"("agentId");

-- CreateIndex
CREATE INDEX "ExtinguisherType_constructionId_idx" ON "ExtinguisherType"("constructionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtinguisherType_code_agentId_key" ON "ExtinguisherType"("code", "agentId");

-- CreateIndex
CREATE INDEX "Part_manufacturerId_idx" ON "Part"("manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "Part_manufacturerId_code_key" ON "Part"("manufacturerId", "code");

-- AddForeignKey
ALTER TABLE "ExtinguisherType" ADD CONSTRAINT "ExtinguisherType_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtinguisherType" ADD CONSTRAINT "ExtinguisherType_constructionId_fkey" FOREIGN KEY ("constructionId") REFERENCES "Construction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartExtinguisherType" ADD CONSTRAINT "PartExtinguisherType_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartExtinguisherType" ADD CONSTRAINT "PartExtinguisherType_extinguisherTypeId_fkey" FOREIGN KEY ("extinguisherTypeId") REFERENCES "ExtinguisherType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
