-- Manufacturer.sortOrder + updatedAt + index za rucni redoslijed prema PUCZ
-- obrascu. Sortiranje u UI-ju vise nije alfabetsko nego po (sortOrder, name).

ALTER TABLE "Manufacturer" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Manufacturer" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Manufacturer_sortOrder_name_idx" ON "Manufacturer"("sortOrder", "name");

-- Backfill prema PUCZ obrascu (15.4.2024).
-- Idempotentno: ako neki naziv ne postoji u bazi, UPDATE jednostavno ne pogodi
-- nijedan red. Ako su postojali stari nazivi (Pastor/Total/Klaleda iz dev seeda),
-- ostaju s sortOrder=0 i obrisat ce ih cleanup-demo-manufacturers skripta.

-- Proizvodjaci (10–80)
UPDATE "Manufacturer" SET "sortOrder" = 10  WHERE "name" = 'PASTOR T.V.A. d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 20  WHERE "name" = 'PASTOR INŽENJERING d.d.';
UPDATE "Manufacturer" SET "sortOrder" = 30  WHERE "name" = 'IV-ER KVC d.o.o. (proizvođač)';
UPDATE "Manufacturer" SET "sortOrder" = 40  WHERE "name" = 'MG-RIJEKA d.o.o. (PRAVNI SLIJEDNIK DIOXA d.o.o.)';
UPDATE "Manufacturer" SET "sortOrder" = 50  WHERE "name" = 'M. G. S. GRUPA d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 60  WHERE "name" = 'ZOP- TEHNOLOŠKE USLUGE d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 70  WHERE "name" = 'VATROSERVIS d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 80  WHERE "name" = 'MALA GORSKA RIJEKA d.o.o.';

-- Uvoznici (90–280)
UPDATE "Manufacturer" SET "sortOrder" = 90  WHERE "name" = 'ZIEGLER d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 100 WHERE "name" = 'ZIS OPREMA d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 110 WHERE "name" = 'IV-ER KVC d.o.o. (uvoznik)';
UPDATE "Manufacturer" SET "sortOrder" = 120 WHERE "name" = 'VATROMAX K.M.B.';
UPDATE "Manufacturer" SET "sortOrder" = 130 WHERE "name" = 'KLALEDA d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 140 WHERE "name" = 'MI-STAR d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 150 WHERE "name" = 'LUVETI d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 160 WHERE "name" = 'JURING d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 170 WHERE "name" = 'PRO MIMATO d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 180 WHERE "name" = 'KOTING d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 190 WHERE "name" = 'TORNADO VALIDUS d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 200 WHERE "name" = 'ELKRON d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 210 WHERE "name" = 'TDS d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 220 WHERE "name" = 'SPERONE TRGOVINA - DUBRAVA d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 230 WHERE "name" = 'FIRE INSPECT d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 240 WHERE "name" = 'EUROCERTUS d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 250 WHERE "name" = 'LOSTURA d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 260 WHERE "name" = 'VATROMEHANIKA – DUBRAVA d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 270 WHERE "name" = 'EMPRESA VENTA d.o.o.';
UPDATE "Manufacturer" SET "sortOrder" = 280 WHERE "name" = 'PREVENTA PLUS d.o.o.';
