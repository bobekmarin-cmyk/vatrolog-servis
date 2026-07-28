/**
 * Idempotentni uvoz dijelova za proizvođača (platform katalog, companyId=null).
 * NE pridružuje tipovima aparata — to se radi kasnije u UI.
 *
 * Pokretanje:
 *   DATABASE_URL="<Railway DATABASE_PUBLIC_URL>" npm run seed:pastor-parts
 */
import { Prisma, PrismaClient, type PartUnit } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

type PartImportRow = {
  code: string;
  name: string;
  unit: PartUnit;
  defaultPrice: number | null;
};

type ManufacturerPartsImport = {
  manufacturerName: string;
  parts: PartImportRow[];
};

function loadPastorParts(): ManufacturerPartsImport {
  const raw = JSON.parse(
    readFileSync(join(__dirname, "data", "pastor-tva-dijelovi.json"), "utf8"),
  ) as PartImportRow[];
  return {
    manufacturerName: "PASTOR T.V.A. d.o.o.",
    parts: raw,
  };
}

function parseUnit(u: string): PartUnit {
  if (u === "KG" || u === "L" || u === "KOM") return u;
  return "KOM";
}

function toDecimal(n: number | null): Prisma.Decimal | null {
  if (n == null || !Number.isFinite(n)) return null;
  return new Prisma.Decimal(n.toFixed(2));
}

export async function importManufacturerParts(
  payload: ManufacturerPartsImport,
  client: PrismaClient = prisma,
): Promise<{ created: number; updated: number }> {
  const manufacturer = await client.manufacturer.findUnique({
    where: { name: payload.manufacturerName },
    select: { id: true, name: true },
  });
  if (!manufacturer) {
    throw new Error(
      `Proizvođač nije pronađen: "${payload.manufacturerName}". Pokreni prvo npm run seed:mfr.`,
    );
  }

  let created = 0;
  let updated = 0;

  for (const row of payload.parts) {
    const code = String(row.code ?? "").trim();
    const name = String(row.name ?? "").replace(/\s+/g, " ").trim();
    const unit = parseUnit(String(row.unit ?? "KOM"));
    const defaultPrice = toDecimal(row.defaultPrice);

    if (!code || !name) {
      console.warn(`  skip: prazan code/name`, row);
      continue;
    }

    const existing = await client.part.findFirst({
      where: { manufacturerId: manufacturer.id, companyId: null, code },
      select: { id: true },
    });

    if (existing) {
      await client.part.update({
        where: { id: existing.id },
        data: {
          name,
          unit,
          manufacturerCode: code,
          defaultPrice,
          active: true,
        },
      });
      updated += 1;
    } else {
      await client.part.create({
        data: {
          manufacturerId: manufacturer.id,
          companyId: null,
          code,
          manufacturerCode: code,
          name,
          unit,
          defaultPrice,
          common: false,
          active: true,
        },
      });
      created += 1;
    }
  }

  console.log(
    `\n${manufacturer.name}: ${created} novih dijelova, ${updated} ažuriranih (bez veza na tipove). Ukupno u uvozu: ${payload.parts.length}.`,
  );
  return { created, updated };
}

async function main() {
  const payload = loadPastorParts();
  console.log(
    `Uvoz dijelova za ${payload.manufacturerName} (${payload.parts.length} stavki, cijena = VPC 1.1.2026.)...`,
  );
  await importManufacturerParts(payload);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
