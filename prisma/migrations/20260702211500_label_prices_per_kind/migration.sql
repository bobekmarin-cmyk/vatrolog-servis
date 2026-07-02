-- Naljepnice na e-računu: svaka vrsta naljepnice je svoja stavka.
-- Cijene po vrsti idu na Company (tab Ovlaštenja), "Komplet naljepnica" se ukida.

-- AlterTable: neto cijene naljepnica po vrsti
ALTER TABLE "Company"
  ADD COLUMN "labelPeriodicPrice" DECIMAL(10,2),
  ADD COLUMN "labelApparatusMassPrice" DECIMAL(10,2),
  ADD COLUMN "labelCylinderMassPrice" DECIMAL(10,2);

-- AlterTable: uklanjanje "Komplet naljepnica" postavki
ALTER TABLE "CompanyERacuniSettings"
  DROP COLUMN "labelKompletCode",
  DROP COLUMN "labelKompletName",
  DROP COLUMN "labelKompletPrice";
