/**
 * Cleanup orphan ExtinguisherType records + wipe CompanyServiceCatalog + resync.
 *
 * Što radi:
 *  1. Identificira orphan tipove aparata (bez ijednog ManufacturerExtinguisherType linka).
 *  2. Force-cascade brisanje za svaki orphan tip:
 *      a) WorkOrderItem.extinguisherId → null za sve aparate tog tipa (FK je nullable).
 *      b) Extinguisher.deleteMany za sve aparate tog tipa.
 *      c) ExtinguisherType.delete.
 *  3. Wipe-a sve redove iz CompanyServiceCatalog (bezuvjetno — testna faza).
 *  4. Pokrene syncCompanyServiceCatalog za sve tvrtke → repopulira katalog samo iz live tipova.
 *
 * Pokretanje:
 *   npx ts-node -P tsconfig.seed.json scripts/wipe-and-resync-service-catalog.ts            (dry-run)
 *   npx ts-node -P tsconfig.seed.json scripts/wipe-and-resync-service-catalog.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { syncCompanyServiceCatalog } from "../src/lib/companyServiceCatalog";

const prisma = new PrismaClient({ log: ["error", "warn"] });
const APPLY = process.argv.includes("--apply");

function header(title: string) {
  const line = "═".repeat(Math.max(8, title.length + 4));
  console.log(`\n${line}\n  ${title}\n${line}`);
}
function sub(title: string) {
  console.log(`\n──── ${title} ────`);
}

async function main() {
  header(APPLY ? "WIPE + RESYNC SERVICE CATALOG (apply)" : "WIPE + RESYNC SERVICE CATALOG (dry-run)");
  if (!APPLY) {
    console.log(
      "Dry-run: prikazujem što bi se obrisalo i koliko redova bi se kreiralo. Dodaj --apply za izvršenje.",
    );
  } else {
    console.log("APPLY: cascade-bri\u0161em orphan tipove, wipe-am katalog, resync-am sve tvrtke.");
  }

  // 1) Identifikacija
  sub("Live vs orphan tipovi aparata");
  const types = await prisma.extinguisherType.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      _count: {
        select: {
          manufacturers: true,
          extinguishers: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });

  const liveTypes = types.filter((t) => t._count.manufacturers > 0);
  const orphanTypes = types.filter((t) => t._count.manufacturers === 0);

  console.log(`  Ukupno tipova: ${types.length}`);
  console.log(`  Live (s manufacturer link-om): ${liveTypes.length}`);
  for (const t of liveTypes) {
    console.log(`    LIVE     ${t.code.padEnd(12)} (${t.name}) — aparata u bazi: ${t._count.extinguishers}`);
  }
  console.log(`  Orphan (bez manufacturer link-a): ${orphanTypes.length}`);
  for (const t of orphanTypes) {
    console.log(`    ORPHAN   ${t.code.padEnd(12)} (${t.name}) — aparata u bazi: ${t._count.extinguishers}`);
  }

  // 2) Cascade plan za orphan tipove
  sub("Plan cascade brisanja za orphan tipove");
  let plannedExtinguisherDeletes = 0;
  let plannedWorkOrderItemNullify = 0;
  for (const t of orphanTypes) {
    const exIds = (
      await prisma.extinguisher.findMany({
        where: { extinguisherTypeId: t.id },
        select: { id: true },
      })
    ).map((e) => e.id);
    plannedExtinguisherDeletes += exIds.length;
    if (exIds.length > 0) {
      const woiCount = await prisma.workOrderItem.count({
        where: { extinguisherId: { in: exIds } },
      });
      plannedWorkOrderItemNullify += woiCount;
      console.log(
        `  • ${t.code}: aparata=${exIds.length}, work-order-item-a za null-ify=${woiCount}`,
      );
    } else {
      console.log(`  • ${t.code}: nema aparata, samo brisanje tipa`);
    }
  }
  if (orphanTypes.length === 0) {
    console.log("  (nema orphan tipova)");
  }

  // 3) Trenutno stanje CompanyServiceCatalog
  sub("CompanyServiceCatalog snapshot");
  const catalogCount = await prisma.companyServiceCatalog.count();
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  console.log(`  Ukupno redova u katalogu: ${catalogCount}`);
  console.log(`  Tvrtki za resync: ${companies.length}`);

  if (!APPLY) {
    sub("Sažetak (dry-run)");
    console.log(`  Orphan ExtinguisherType za brisanje:        ${orphanTypes.length}`);
    console.log(`  Aparata za cascade brisanje:                 ${plannedExtinguisherDeletes}`);
    console.log(`  WorkOrderItem.extinguisherId → null:         ${plannedWorkOrderItemNullify}`);
    console.log(`  CompanyServiceCatalog redova za brisanje:    ${catalogCount}`);
    console.log(
      `  Live tipova nakon brisanja:                  ${liveTypes.length} → katalog će imati ${liveTypes.length * 2 * companies.length} redova (${liveTypes.length} tip × 2 kind × ${companies.length} tvrtki).`,
    );
    console.log("\n  Pokreni s --apply za izvršenje.");
    return;
  }

  // ───────────────────────────── APPLY MODE ─────────────────────────────
  header("APPLY: izvodim cascade + wipe + resync");

  // 2a) Cascade brisanje orphan tipova.
  let actualExtinguisherDeletes = 0;
  let actualWorkOrderItemNullify = 0;
  let actualOrphanTypeDeletes = 0;
  for (const t of orphanTypes) {
    const exIds = (
      await prisma.extinguisher.findMany({
        where: { extinguisherTypeId: t.id },
        select: { id: true },
      })
    ).map((e) => e.id);

    if (exIds.length > 0) {
      const woi = await prisma.workOrderItem.updateMany({
        where: { extinguisherId: { in: exIds } },
        data: { extinguisherId: null },
      });
      actualWorkOrderItemNullify += woi.count;

      const ex = await prisma.extinguisher.deleteMany({
        where: { id: { in: exIds } },
      });
      actualExtinguisherDeletes += ex.count;

      console.log(
        `  ✓ ${t.code}: nullified ${woi.count} WorkOrderItem(a), obrisano ${ex.count} aparat(a)`,
      );
    }

    await prisma.extinguisherType.delete({ where: { id: t.id } });
    actualOrphanTypeDeletes += 1;
    console.log(`  ✓ ${t.code}: ExtinguisherType obrisan`);
  }

  // 3a) Wipe katalog.
  const wipe = await prisma.companyServiceCatalog.deleteMany({});
  console.log(`\n  ✓ CompanyServiceCatalog: obrisano ${wipe.count} redova`);

  // 4) Resync.
  const created = await syncCompanyServiceCatalog(null, {});
  console.log(`  ✓ Resync gotov, novokreiranih redova: ${created}`);

  sub("Sažetak (apply)");
  console.log(`  Orphan tipova obrisano:         ${actualOrphanTypeDeletes}`);
  console.log(`  Aparata obrisano:                ${actualExtinguisherDeletes}`);
  console.log(`  WorkOrderItem nullified:         ${actualWorkOrderItemNullify}`);
  console.log(`  CompanyServiceCatalog wipe:      ${wipe.count}`);
  console.log(`  CompanyServiceCatalog kreirano:  ${created}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
