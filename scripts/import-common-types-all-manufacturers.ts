/**
 * Uvoz najčešćih tipova aparata i veza na sve proizvođače
 * osim PASTOR T.V.A. i KLALEDA.
 *
 *   DATABASE_URL="..." npm run seed:common-types
 */
import { PrismaClient } from "@prisma/client";
import { importManufacturerTypes, type ManufacturerTypesImport } from "./import-manufacturer-types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { COMMON_APARATI, EXCLUDE_MANUFACTURER_NAMES } = require("./data/common-aparati.js") as {
  COMMON_APARATI: { types: ManufacturerTypesImport["types"] };
  EXCLUDE_MANUFACTURER_NAMES: string[];
};

const prisma = new PrismaClient();

async function main() {
  const exclude = new Set(EXCLUDE_MANUFACTURER_NAMES);
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
  const targets = manufacturers.filter((m) => !exclude.has(m.name));

  console.log(
    `Zajednički tipovi (${COMMON_APARATI.types.length}): ${COMMON_APARATI.types.map((t) => t.code).join(", ")}`,
  );
  console.log(`Isključeni: ${EXCLUDE_MANUFACTURER_NAMES.join(", ")}`);
  console.log(`Ciljani proizvođači: ${targets.length} / ${manufacturers.length}\n`);

  let totalLinked = 0;
  for (const m of targets) {
    const r = await importManufacturerTypes(
      { manufacturerName: m.name, types: COMMON_APARATI.types },
      prisma,
    );
    totalLinked += r.linked;
  }

  console.log(`\nGotovo. Novih veza proizvođač↔tip: ${totalLinked}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
