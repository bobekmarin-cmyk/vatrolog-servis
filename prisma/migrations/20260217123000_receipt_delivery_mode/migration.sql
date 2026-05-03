-- Add delivery mode to receipts (Kupac/Serviser)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReceiptDeliveryMode') THEN
    CREATE TYPE "ReceiptDeliveryMode" AS ENUM ('CUSTOMER', 'SERVISER');
  END IF;
END $$;

ALTER TABLE "Receipt"
  ADD COLUMN IF NOT EXISTS "deliveryMode" "ReceiptDeliveryMode";

UPDATE "Receipt"
SET "deliveryMode" = 'CUSTOMER'
WHERE "deliveryMode" IS NULL;

ALTER TABLE "Receipt"
  ALTER COLUMN "deliveryMode" SET NOT NULL;

