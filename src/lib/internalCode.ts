import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { formatLabelCode } from "@/lib/labelSheets";

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

async function resolveLastNumber(
  find: (weightCode: string) => Promise<{ lastNumber: number } | null>,
  weightCode: string,
): Promise<number> {
  const www = normalizeWeightCode(weightCode);
  const current = await find(www);
  if (current) return current.lastNumber;

  const legacy = legacyTwoDigitWeightCode(www);
  if (legacy !== www) {
    const old = await find(legacy);
    if (old) return old.lastNumber;
  }
  return 0;
}

export async function previewNextInternalCode(companyId: string, serviceCode: string, weightCode: string) {
  const www = normalizeWeightCode(weightCode);
  const last = await resolveLastNumber(
    (code) =>
      prisma.internalCodeCounter.findUnique({
        where: { companyId_weightCode: { companyId, weightCode: code } },
        select: { lastNumber: true },
      }),
    www,
  );
  return formatInternalCode(serviceCode, www, last + 1);
}

export async function allocateNextInternalCodeTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  serviceCode: string,
  weightCode: string,
) {
  const www = normalizeWeightCode(weightCode);

  const existing = await tx.internalCodeCounter.findUnique({
    where: { companyId_weightCode: { companyId, weightCode: www } },
    select: { id: true },
  });

  // Jednokratno: preuzmi lastNumber sa starog 2-znamenkastog ključa ("03" → "003").
  if (!existing) {
    const legacy = legacyTwoDigitWeightCode(www);
    if (legacy !== www) {
      const legacyCounter = await tx.internalCodeCounter.findUnique({
        where: { companyId_weightCode: { companyId, weightCode: legacy } },
        select: { lastNumber: true },
      });
      if (legacyCounter) {
        const next = legacyCounter.lastNumber + 1;
        await tx.internalCodeCounter.create({
          data: { companyId, weightCode: www, lastNumber: next },
        });
        return formatInternalCode(serviceCode, www, next);
      }
    }
  }

  const counter = await tx.internalCodeCounter.upsert({
    where: { companyId_weightCode: { companyId, weightCode: www } },
    create: { companyId, weightCode: www, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });

  return formatInternalCode(serviceCode, www, counter.lastNumber);
}
