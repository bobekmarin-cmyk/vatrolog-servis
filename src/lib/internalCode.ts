import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { formatLabelCode } from "@/lib/labelSheets";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Težina u ključu brojača / formatu: uvijek 3 znamenke (003, 006, 050),
 * isto kao QR naljepnice (`formatLabelCode`).
 */
export function normalizeWeightCode(weightCode: string): string {
  const digits = weightCode.replace(/\D/g, "");
  if (!digits) return "000";
  return digits.padStart(3, "0").slice(-3);
}

/** Stari 2-znamenkasti ključ brojača (npr. "03") — za migraciju na "003". */
function legacyTwoDigitWeightCode(weightCode: string): string {
  return normalizeWeightCode(weightCode).slice(-2);
}

/** Prefiks SS+WWW (5 znamenki) za 10-znamenkasti interni broj. */
export function internalCodePrefix(serviceCode: string, weightCode: string): string {
  const weight = Number.parseInt(normalizeWeightCode(weightCode), 10) || 0;
  return formatLabelCode(serviceCode, weight, 0).slice(0, 5);
}

/**
 * Iz postojećeg internog broja izvuci težinu i redni broj (novi 10-znamenkasti format).
 * Vraća null ako format ne odgovara šifri servisa.
 */
export function parseInternalCodeSeq(
  internalCode: string,
  serviceCode: string,
): { weightCode: string; seq: number } | null {
  const digits = String(internalCode ?? "").replace(/\D/g, "");
  if (digits.length !== 10) return null;
  const ss = serviceCode.replace(/\D/g, "").padStart(2, "0").slice(-2);
  if (digits.slice(0, 2) !== ss) return null;
  const weightCode = digits.slice(2, 5);
  const seq = Number.parseInt(digits.slice(5), 10);
  if (!Number.isFinite(seq) || seq < 0) return null;
  return { weightCode, seq };
}

export async function getWeightCodeForType(extinguisherTypeId: string): Promise<string> {
  const type = await prisma.extinguisherType.findUnique({
    where: { id: extinguisherTypeId },
    select: { capacity: true, capacityUnit: true },
  });

  // Kapacitet kao troznamenkasta težina (003, 006, 050), usklađeno s QR naljepnicama.
  if (typeof type?.capacity !== "number") return "000";
  return normalizeWeightCode(String(Math.trunc(type.capacity)));
}

/**
 * Format internog broja: SS WWW NNNNN (10 znamenki) — isti kao `formatLabelCode`.
 * Primjer: serviceCode "01", težina 3, redni 1 → "0100300001".
 */
export function formatInternalCode(serviceCode: string, weightCode: string, seq: number): string {
  const weight = Number.parseInt(normalizeWeightCode(weightCode), 10) || 0;
  return formatLabelCode(serviceCode, weight, seq);
}

/**
 * Najveći zauzeti redni broj za težinu među postojećim aparatima (bez soft-deleted).
 * Nakon brisanja svih aparata vraća 0 → sljedeći predloženi je 00001.
 */
export async function getMaxUsedInternalSeq(
  db: DbClient,
  companyId: string,
  serviceCode: string,
  weightCode: string,
): Promise<number> {
  const www = normalizeWeightCode(weightCode);
  const prefix = internalCodePrefix(serviceCode, www);

  const rows = await db.extinguisher.findMany({
    where: {
      companyId,
      deletedAt: null,
      internalCode: { startsWith: prefix },
    },
    select: { internalCode: true },
  });

  let max = 0;
  for (const row of rows) {
    const code = String(row.internalCode ?? "").replace(/\D/g, "");
    if (code.length !== 10 || !code.startsWith(prefix)) continue;
    const seq = Number.parseInt(code.slice(5), 10);
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return max;
}

/**
 * Uskladi brojač s max zauzetim rednim brojem (npr. nakon hard-delete aparata).
 */
export async function syncInternalCodeCounter(
  db: DbClient,
  companyId: string,
  serviceCode: string,
  weightCode: string,
): Promise<number> {
  const www = normalizeWeightCode(weightCode);
  const maxUsed = await getMaxUsedInternalSeq(db, companyId, serviceCode, www);

  await db.internalCodeCounter.upsert({
    where: { companyId_weightCode: { companyId, weightCode: www } },
    create: { companyId, weightCode: www, lastNumber: maxUsed },
    update: { lastNumber: maxUsed },
  });

  return maxUsed;
}

export async function previewNextInternalCode(
  companyId: string,
  serviceCode: string,
  weightCode: string,
) {
  const www = normalizeWeightCode(weightCode);
  // Izvor istine: postojeći aparati. Obrisani kodovi se ponovno nude od 00001.
  const maxUsed = await getMaxUsedInternalSeq(prisma, companyId, serviceCode, www);
  return formatInternalCode(serviceCode, www, maxUsed + 1);
}

export async function allocateNextInternalCodeTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  serviceCode: string,
  weightCode: string,
) {
  const www = normalizeWeightCode(weightCode);
  const maxUsed = await getMaxUsedInternalSeq(tx, companyId, serviceCode, www);

  const existing = await tx.internalCodeCounter.findUnique({
    where: { companyId_weightCode: { companyId, weightCode: www } },
    select: { lastNumber: true },
  });

  // Pod i iznad: brojač ne smije zaostajati za zauzetim kodovima, niti ostati
  // iznad nakon brisanja (inače predlaže 00004 kad je sve obrisano).
  const floor = maxUsed;

  if (!existing) {
    const legacy = legacyTwoDigitWeightCode(www);
    if (legacy !== www) {
      // Stari ključ više ne koristimo kao izvor — floor dolazi iz aparata.
      await tx.internalCodeCounter.deleteMany({
        where: { companyId, weightCode: legacy },
      });
    }
    await tx.internalCodeCounter.create({
      data: { companyId, weightCode: www, lastNumber: floor + 1 },
    });
    return formatInternalCode(serviceCode, www, floor + 1);
  }

  if (existing.lastNumber !== floor) {
    await tx.internalCodeCounter.update({
      where: { companyId_weightCode: { companyId, weightCode: www } },
      data: { lastNumber: floor },
    });
  }

  const counter = await tx.internalCodeCounter.update({
    where: { companyId_weightCode: { companyId, weightCode: www } },
    data: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });

  return formatInternalCode(serviceCode, www, counter.lastNumber);
}
