-- Link receipts/work orders to customer departments (optional)

ALTER TABLE "Receipt" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN "departmentId" TEXT;

CREATE INDEX "Receipt_companyId_departmentId_idx" ON "Receipt"("companyId", "departmentId");
CREATE INDEX "WorkOrder_companyId_departmentId_idx" ON "WorkOrder"("companyId", "departmentId");

ALTER TABLE "Receipt"
ADD CONSTRAINT "Receipt_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "CustomerDepartment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkOrder"
ADD CONSTRAINT "WorkOrder_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "CustomerDepartment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

