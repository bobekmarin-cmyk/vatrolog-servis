-- Add baseReceivedQty to Receipt + add ReceiptAddendum for extra intakes

ALTER TABLE "Receipt"
  ADD COLUMN IF NOT EXISTS "baseReceivedQty" INTEGER;

UPDATE "Receipt"
SET "baseReceivedQty" = "receivedQty"
WHERE "baseReceivedQty" IS NULL;

ALTER TABLE "Receipt"
  ALTER COLUMN "baseReceivedQty" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "ReceiptAddendum" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "qty" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReceiptAddendum_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReceiptAddendum_companyId_fkey'
  ) THEN
    ALTER TABLE "ReceiptAddendum"
      ADD CONSTRAINT "ReceiptAddendum_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReceiptAddendum_receiptId_fkey'
  ) THEN
    ALTER TABLE "ReceiptAddendum"
      ADD CONSTRAINT "ReceiptAddendum_receiptId_fkey"
      FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ReceiptAddendum_companyId_idx" ON "ReceiptAddendum"("companyId");
CREATE INDEX IF NOT EXISTS "ReceiptAddendum_receiptId_receivedAt_idx" ON "ReceiptAddendum"("receiptId", "receivedAt");
CREATE INDEX IF NOT EXISTS "ReceiptAddendum_companyId_receivedAt_idx" ON "ReceiptAddendum"("companyId", "receivedAt");

