-- AlterTable
ALTER TABLE "WorkOrderItem" ADD COLUMN     "targetInternalMonth" TIMESTAMP(3),
ADD COLUMN     "targetPeriodicMonth" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WorkOrderItem_targetPeriodicMonth_idx" ON "WorkOrderItem"("targetPeriodicMonth");

-- CreateIndex
CREATE INDEX "WorkOrderItem_targetInternalMonth_idx" ON "WorkOrderItem"("targetInternalMonth");

-- Backfill: za postojeće servisirane stavke aproksimiramo target mjesec servisiranim datumom,
-- a za neservisirane preuzimamo trenutni nextPeriodicDue / nextInternalDue s pripadajućeg aparata.
UPDATE "WorkOrderItem" AS w
SET
  "targetPeriodicMonth" = COALESCE(w."targetPeriodicMonth", w."servicedAt"),
  "targetInternalMonth" = COALESCE(w."targetInternalMonth", w."internalDoneAt", w."servicedAt")
WHERE w."servicedAt" IS NOT NULL;

UPDATE "WorkOrderItem" AS w
SET
  "targetPeriodicMonth" = COALESCE(w."targetPeriodicMonth", e."nextPeriodicDue"),
  "targetInternalMonth" = COALESCE(w."targetInternalMonth", e."nextInternalDue")
FROM "Extinguisher" AS e
WHERE w."extinguisherId" = e."id"
  AND w."servicedAt" IS NULL
  AND w."isPlaceholder" = false;
