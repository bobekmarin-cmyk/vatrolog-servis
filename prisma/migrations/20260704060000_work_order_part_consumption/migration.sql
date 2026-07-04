-- CreateTable
CREATE TABLE "WorkOrderPartConsumption" (
    "workOrderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderPartConsumption_pkey" PRIMARY KEY ("workOrderId","partId")
);

-- CreateIndex
CREATE INDEX "WorkOrderPartConsumption_workOrderId_idx" ON "WorkOrderPartConsumption"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderPartConsumption_partId_idx" ON "WorkOrderPartConsumption"("partId");

-- AddForeignKey
ALTER TABLE "WorkOrderPartConsumption" ADD CONSTRAINT "WorkOrderPartConsumption_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPartConsumption" ADD CONSTRAINT "WorkOrderPartConsumption_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: za trenutno zaključane naloge upiši snapshot potrošnje dijelova
-- iz živih stavki (stanje skladišta je za njih već umanjeno kod zaključavanja).
INSERT INTO "WorkOrderPartConsumption" ("workOrderId", "partId", "quantity")
SELECT wo."id", p."partId", SUM(p."quantity")
FROM "WorkOrderItemPart" p
JOIN "WorkOrderItem" i ON i."id" = p."workOrderItemId"
JOIN "WorkOrder" wo ON wo."id" = i."workOrderId"
WHERE wo."status" = 'LOCKED'
GROUP BY wo."id", p."partId"
ON CONFLICT DO NOTHING;
