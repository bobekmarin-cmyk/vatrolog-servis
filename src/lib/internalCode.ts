import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

export async function getWeightCodeForType(extinguisherTypeId: string): Promise<string> {
  const type = await prisma.extinguisherType.findUnique({
    where: { id: extinguisherTypeId },
    select: { capacity: true, capacityUnit: true },
  });

  // Kapacitet koristimo kao dio internog broja (npr. 06, 09, 50),
  // bez obzira na jedinicu. Ako nema kapaciteta, fallback je "00".
  return typeof type?.capacity === "number" ? pad2(type.capacity) : "00";
}

export function formatInternalCode(serviceCode: string, weightCode: string, seq: number): string {
  // Format: SS KK NNNN, npr. 10 09 0001 -> 10090001.
  return `${serviceCode}${weightCode}${pad4(seq)}`;
}

export async function previewNextInternalCode(companyId: string, serviceCode: string, weightCode: string) {
  const counter = await prisma.internalCodeCounter.findUnique({
    where: { companyId_weightCode: { companyId, weightCode } },
    select: { lastNumber: true },
  });
  const next = (counter?.lastNumber ?? 0) + 1;
  return formatInternalCode(serviceCode, weightCode, next);
}

export async function allocateNextInternalCodeTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  serviceCode: string,
  weightCode: string
) {
  const counter = await tx.internalCodeCounter.upsert({
    where: { companyId_weightCode: { companyId, weightCode } },
    create: { companyId, weightCode, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });

  return formatInternalCode(serviceCode, weightCode, counter.lastNumber);
}

