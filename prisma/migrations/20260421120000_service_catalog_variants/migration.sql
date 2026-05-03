-- Wipe and recreate CompanyServiceCatalog keyed on service variant
-- (agent + construction + capacity + capacityUnit) instead of extinguisherTypeId.
DROP TABLE IF EXISTS "CompanyServiceCatalog" CASCADE;

CREATE TABLE "CompanyServiceCatalog" (
  "id"             TEXT NOT NULL,
  "companyId"      TEXT NOT NULL,
  "agentId"        TEXT NOT NULL,
  "constructionId" TEXT,
  "capacity"       INTEGER,
  "capacityUnit"   "CapacityUnit",
  "fallbackLabel"  TEXT,
  "variantKey"     TEXT NOT NULL,
  "kind"           "ServiceKind" NOT NULL,
  "code"           TEXT,
  "price"          DECIMAL(10,2),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyServiceCatalog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "CompanyServiceCatalog_companyId_variantKey_kind_key"
  ON "CompanyServiceCatalog"("companyId", "variantKey", "kind");
CREATE INDEX "CompanyServiceCatalog_companyId_idx"
  ON "CompanyServiceCatalog"("companyId");
CREATE INDEX "CompanyServiceCatalog_agentId_idx"
  ON "CompanyServiceCatalog"("agentId");
CREATE INDEX "CompanyServiceCatalog_constructionId_idx"
  ON "CompanyServiceCatalog"("constructionId");

-- Foreign keys
ALTER TABLE "CompanyServiceCatalog"
  ADD CONSTRAINT "CompanyServiceCatalog_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyServiceCatalog"
  ADD CONSTRAINT "CompanyServiceCatalog_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "AgentType"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyServiceCatalog"
  ADD CONSTRAINT "CompanyServiceCatalog_constructionId_fkey"
  FOREIGN KEY ("constructionId") REFERENCES "Construction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
