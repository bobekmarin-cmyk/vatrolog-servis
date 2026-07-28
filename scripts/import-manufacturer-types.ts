/**
 * Idempotentni uvoz tipova aparata za jednog proizvođača.
 *
 * - Upsert ExtinguisherType po (code, agentId)
 * - Veza ManufacturerExtinguisherType
 * - syncCompanyServiceCatalog za svaki tip
 *
 * Pokretanje (produkcija / Railway):
 *   DATABASE_URL="<Railway DATABASE_PUBLIC_URL>" npm run seed:pastor-types
 *
 * Drugi proizvođači: dodaj data datoteku u scripts/data/ i pozovi
 *   importManufacturerTypes(require("./data/..."))
 */
import { PrismaClient, type CapacityUnit, type InternalRuleMode } from "@prisma/client";
import { formatExtinguisherTypeName } from "../src/lib/formatExtinguisherType";
import { syncCompanyServiceCatalog } from "../src/lib/companyServiceCatalog";
import { buildVariantSnapshot } from "../src/lib/serviceVariant";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PASTOR_TVA_APARATI } = require("./data/pastor-tva-aparati.js") as {
  PASTOR_TVA_APARATI: ManufacturerTypesImport;
};

export type TypeImportRow = {
  code: string;
  agentCode: string;
  constructionCode: string;
  capacity: number;
  capacityUnit: CapacityUnit;
  internalRuleMode: InternalRuleMode;
  internalIntervalYears: number;
  internalOldThresholdYears: number | null;
  internalYoungIntervalYears: number | null;
  internalOldIntervalYears: number | null;
};

export type ManufacturerTypesImport = {
  manufacturerName: string;
  types: TypeImportRow[];
};

const prisma = new PrismaClient();

function mapExcelConstruction(raw: string): string {
  const u = raw.trim().toUpperCase();
  if (u === "ST" || u === "STP" || u === "STORED_PRESSURE" || u === "STALNI TLAK") {
    return "STORED_PRESSURE";
  }
  if (u === "BOČICA" || u === "BOCICA" || u === "BO" || u === "CARTRIDGE") {
    return "CARTRIDGE";
  }
  if (u === "CO2" || u === "CO₂") return "CO2";
  return u;
}

function mapExcelAgent(raw: string): string {
  const u = raw.trim().toUpperCase().replace("₂", "2");
  if (u === "PRAH" || u === "ABC") return "PRAH";
  if (u === "PJENA" || u === "PJENA/FOAM" || u === "FOAM") return "PJENA";
  if (u === "CO2") return "CO2";
  if (u === "VODA" || u === "WATER") return "VODA";
  if (u === "WET_CHEMICAL" || u === "WET CHEMICAL") return "WET_CHEMICAL";
  if (u === "F500" || u === "F-500") return "F500";
  return u;
}

export async function importManufacturerTypes(
  payload: ManufacturerTypesImport,
  client: PrismaClient = prisma,
): Promise<{ created: number; updated: number; linked: number }> {
  const manufacturer = await client.manufacturer.findUnique({
    where: { name: payload.manufacturerName },
    select: { id: true, name: true },
  });
  if (!manufacturer) {
    throw new Error(
      `Proizvođač nije pronađen: "${payload.manufacturerName}". Pokreni prvo npm run seed:mfr.`,
    );
  }

  const agents = await client.agentType.findMany({ select: { id: true, code: true, label: true, symbol: true } });
  const constructions = await client.construction.findMany({
    select: { id: true, code: true, label: true, prefix: true },
  });
  const agentByCode = new Map(agents.map((a) => [a.code, a]));
  const conByCode = new Map(constructions.map((c) => [c.code, c]));

  let created = 0;
  let updated = 0;
  let linked = 0;

  for (const row of payload.types) {
    const code = String(row.code).trim().toUpperCase();
    const agentCode = mapExcelAgent(row.agentCode);
    const constructionCode = mapExcelConstruction(row.constructionCode);
    const agent = agentByCode.get(agentCode);
    const construction = conByCode.get(constructionCode);
    if (!agent) throw new Error(`Nepoznato sredstvo gašenja: ${row.agentCode} (→ ${agentCode})`);
    if (!construction) {
      throw new Error(`Nepoznata izvedba: ${row.constructionCode} (→ ${constructionCode})`);
    }

    const capacity = Math.trunc(Number(row.capacity));
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new Error(`Neispravna količina za ${code}: ${row.capacity}`);
    }
    const capacityUnit: CapacityUnit = row.capacityUnit === "L" ? "L" : "KG";

    const isCo2 = agent.code === "CO2";
    if (!isCo2) {
      const snap = buildVariantSnapshot({
        code,
        agentId: agent.id,
        constructionId: construction.id,
        capacity,
        capacityUnit,
        construction: { prefix: construction.prefix },
      });
      if (snap.fallbackLabel !== null) {
        throw new Error(
          `Tip ${code} bi pao u fallback varijantu (prefix/capacity). Provjeri izvedbu i količinu.`,
        );
      }
    }

    if (row.internalRuleMode !== "FIXED" && row.internalRuleMode !== "AGE_BASED") {
      throw new Error(`Tip ${code}: internalRuleMode mora biti FIXED ili AGE_BASED`);
    }
    if (row.internalRuleMode === "FIXED") {
      if (!(row.internalIntervalYears > 0)) {
        throw new Error(`Tip ${code}: FIXED zahtijeva positive internalIntervalYears`);
      }
    } else if (
      !(row.internalOldThresholdYears! > 0) ||
      !(row.internalYoungIntervalYears! > 0) ||
      !(row.internalOldIntervalYears! > 0)
    ) {
      throw new Error(`Tip ${code}: AGE_BASED zahtijeva prag + young + old interval`);
    }

    const displayName = formatExtinguisherTypeName({
      code,
      agent: { code: agent.code, label: agent.label, symbol: agent.symbol },
      construction: { code: construction.code, label: construction.label },
    });

    const data = {
      name: displayName,
      constructionId: construction.id,
      capacity,
      capacityUnit,
      internalRuleMode: row.internalRuleMode,
      internalIntervalYears: row.internalIntervalYears,
      internalOldThresholdYears:
        row.internalRuleMode === "AGE_BASED" ? row.internalOldThresholdYears : null,
      internalYoungIntervalYears:
        row.internalRuleMode === "AGE_BASED" ? row.internalYoungIntervalYears : null,
      internalOldIntervalYears:
        row.internalRuleMode === "AGE_BASED" ? row.internalOldIntervalYears : null,
    };

    const existing = await client.extinguisherType.findUnique({
      where: { code_agentId: { code, agentId: agent.id } },
      select: { id: true },
    });

    let typeId: string;
    if (existing) {
      await client.extinguisherType.update({ where: { id: existing.id }, data });
      typeId = existing.id;
      updated += 1;
    } else {
      const createdType = await client.extinguisherType.create({
        data: {
          code,
          agentId: agent.id,
          ...data,
        },
        select: { id: true },
      });
      typeId = createdType.id;
      created += 1;
    }

    const linkBefore = await client.manufacturerExtinguisherType.findUnique({
      where: {
        manufacturerId_extinguisherTypeId: {
          manufacturerId: manufacturer.id,
          extinguisherTypeId: typeId,
        },
      },
      select: { manufacturerId: true },
    });
    await client.manufacturerExtinguisherType.upsert({
      where: {
        manufacturerId_extinguisherTypeId: {
          manufacturerId: manufacturer.id,
          extinguisherTypeId: typeId,
        },
      },
      update: {},
      create: { manufacturerId: manufacturer.id, extinguisherTypeId: typeId },
    });
    if (!linkBefore) linked += 1;

    await syncCompanyServiceCatalog(client, { extinguisherTypeId: typeId });

    console.log(
      `  ${existing ? "upd" : "new"} ${displayName}  [${agent.code}/${construction.code} ${capacity}${capacityUnit}]  UP=${row.internalRuleMode}`,
    );
  }

  console.log(
    `\n${manufacturer.name}: ${created} novih tipova, ${updated} ažuriranih, ${linked} novih veza proizvođač↔tip.`,
  );
  return { created, updated, linked };
}

async function main() {
  console.log(`Uvoz aparata za ${PASTOR_TVA_APARATI.manufacturerName} (${PASTOR_TVA_APARATI.types.length} tipova)...`);
  await importManufacturerTypes(PASTOR_TVA_APARATI);
}

const isDirectRun =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;

if (isDirectRun) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}