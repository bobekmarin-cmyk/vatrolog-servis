-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('PERIODIC', 'INTERNAL');

-- CreateTable
CREATE TABLE "CompanyServiceCatalog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "extinguisherTypeId" TEXT NOT NULL,
    "kind" "ServiceKind" NOT NULL,
    "code" TEXT,
    "price" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyServiceCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyServiceCatalog_companyId_idx" ON "CompanyServiceCatalog"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyServiceCatalog_companyId_extinguisherTypeId_kind_key" ON "CompanyServiceCatalog"("companyId", "extinguisherTypeId", "kind");

-- AddForeignKey
ALTER TABLE "CompanyServiceCatalog" ADD CONSTRAINT "CompanyServiceCatalog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyServiceCatalog" ADD CONSTRAINT "CompanyServiceCatalog_extinguisherTypeId_fkey" FOREIGN KEY ("extinguisherTypeId") REFERENCES "ExtinguisherType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
