-- 1) Create a default company (for existing data)
INSERT INTO "Company" ("id","name","oib","street","city","postalCode","iban","createdAt","updatedAt")
VALUES (
  'company_default',
  'Moja tvrtka',
  '00000000000',
  'Ulica 1',
  'Grad',
  '00000',
  'HR0000000000000000000',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- 2) Assign all existing servicers (User) to default company
UPDATE "User"
SET "companyId" = 'company_default'
WHERE "companyId" IS NULL;

-- 3) Make companyId required now that data is backfilled
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;
