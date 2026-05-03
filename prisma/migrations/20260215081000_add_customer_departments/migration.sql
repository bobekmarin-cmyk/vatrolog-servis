-- Add customer departments (odjeljenja) for customers
-- Each department belongs to a customer and a company (tenant scope).

CREATE TABLE "CustomerDepartment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactPerson" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerDepartment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerDepartment_companyId_idx" ON "CustomerDepartment"("companyId");
CREATE INDEX "CustomerDepartment_customerId_idx" ON "CustomerDepartment"("customerId");

CREATE UNIQUE INDEX "CustomerDepartment_customerId_name_key" ON "CustomerDepartment"("customerId", "name");

ALTER TABLE "CustomerDepartment"
ADD CONSTRAINT "CustomerDepartment_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerDepartment"
ADD CONSTRAINT "CustomerDepartment_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

