-- Vlastite (slobodne) usluge tenanta + veza sa stavkama radnog naloga.

CREATE TABLE "CompanyCustomService" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "price" DECIMAL(10,2),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyCustomService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyCustomService_companyId_name_key"
    ON "CompanyCustomService" ("companyId", "name");

CREATE INDEX "CompanyCustomService_companyId_idx"
    ON "CompanyCustomService" ("companyId");

ALTER TABLE "CompanyCustomService"
    ADD CONSTRAINT "CompanyCustomService_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE "WorkOrderItemCustomService" (
    "companyId" TEXT NOT NULL,
    "workOrderItemId" TEXT NOT NULL,
    "customServiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkOrderItemCustomService_pkey"
        PRIMARY KEY ("workOrderItemId", "customServiceId")
);

CREATE INDEX "WorkOrderItemCustomService_customServiceId_idx"
    ON "WorkOrderItemCustomService" ("customServiceId");

CREATE INDEX "WorkOrderItemCustomService_companyId_idx"
    ON "WorkOrderItemCustomService" ("companyId");

ALTER TABLE "WorkOrderItemCustomService"
    ADD CONSTRAINT "WorkOrderItemCustomService_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkOrderItemCustomService"
    ADD CONSTRAINT "WorkOrderItemCustomService_workOrderItemId_fkey"
    FOREIGN KEY ("workOrderItemId") REFERENCES "WorkOrderItem" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkOrderItemCustomService"
    ADD CONSTRAINT "WorkOrderItemCustomService_customServiceId_fkey"
    FOREIGN KEY ("customServiceId") REFERENCES "CompanyCustomService" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
