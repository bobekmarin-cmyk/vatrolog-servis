-- Postgres NE stvara indeks automatski nad kolonom stranog kljuca. Bez njih
-- Prisma relacijski upiti (`WHERE "workOrderId" IN (...)`) rade sekvencijalni
-- scan cijele tablice.
--
-- Najvazniji je WorkOrderItem_workOrderId: ucitava se na listi naloga, detalju
-- naloga, upisniku, primci i otpremnici — dakle na svakom koraku servisera.

-- ── Radni nalozi (najtopliji put) ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "WorkOrderItem_workOrderId_idx" ON "WorkOrderItem"("workOrderId");
CREATE INDEX IF NOT EXISTS "WorkOrderItem_extinguisherId_idx" ON "WorkOrderItem"("extinguisherId");
CREATE INDEX IF NOT EXISTS "WorkOrderItem_servicerId_idx" ON "WorkOrderItem"("servicerId");

CREATE INDEX IF NOT EXISTS "WorkOrder_customerId_idx" ON "WorkOrder"("customerId");
CREATE INDEX IF NOT EXISTS "WorkOrder_departmentId_idx" ON "WorkOrder"("departmentId");
CREATE INDEX IF NOT EXISTS "WorkOrder_serviceLocationId_idx" ON "WorkOrder"("serviceLocationId");
CREATE INDEX IF NOT EXISTS "WorkOrder_createdByAccountUserId_idx" ON "WorkOrder"("createdByAccountUserId");
CREATE INDEX IF NOT EXISTS "WorkOrder_lockedById_idx" ON "WorkOrder"("lockedById");

CREATE INDEX IF NOT EXISTS "DeliveryNote_issuedByAccountUserId_idx" ON "DeliveryNote"("issuedByAccountUserId");
CREATE INDEX IF NOT EXISTS "DocumentLog_userId_idx" ON "DocumentLog"("userId");

-- ── Aparati i katalog ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Extinguisher_manufacturerId_idx" ON "Extinguisher"("manufacturerId");
CREATE INDEX IF NOT EXISTS "Extinguisher_extinguisherTypeId_idx" ON "Extinguisher"("extinguisherTypeId");
CREATE INDEX IF NOT EXISTS "CompanyPartCatalogSetting_manufacturerId_idx" ON "CompanyPartCatalogSetting"("manufacturerId");

-- ── Skladiste dijelova ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "PartStock_partId_idx" ON "PartStock"("partId");
CREATE INDEX IF NOT EXISTS "StockReceipt_createdById_idx" ON "StockReceipt"("createdById");
CREATE INDEX IF NOT EXISTS "StockAdjustment_partId_idx" ON "StockAdjustment"("partId");
CREATE INDEX IF NOT EXISTS "StockAdjustment_createdById_idx" ON "StockAdjustment"("createdById");

-- ── Skladiste naljepnica ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "ServiceLabelStock_serviceLabelId_idx" ON "ServiceLabelStock"("serviceLabelId");
CREATE INDEX IF NOT EXISTS "ServiceLabelReceipt_createdById_idx" ON "ServiceLabelReceipt"("createdById");
CREATE INDEX IF NOT EXISTS "ServiceLabelAdjustment_serviceLabelId_idx" ON "ServiceLabelAdjustment"("serviceLabelId");
CREATE INDEX IF NOT EXISTS "ServiceLabelAdjustment_createdById_idx" ON "ServiceLabelAdjustment"("createdById");

-- ── Ostalo ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "OwnerCustomerLink_invitedByAccountUserId_idx" ON "OwnerCustomerLink"("invitedByAccountUserId");
CREATE INDEX IF NOT EXISTS "Notification_authorPlatformUserId_idx" ON "Notification"("authorPlatformUserId");
