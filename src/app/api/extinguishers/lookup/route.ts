import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const internalCode = String(searchParams.get("internalCode") || "").trim();

  if (!internalCode) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  const extinguisher = await prisma.extinguisher.findUnique({
    where: { companyId_internalCode: { companyId: session.companyId, internalCode } },
    include: {
      manufacturer: true,
      type: true,
    },
  });

  if (!extinguisher) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  return NextResponse.json(
    {
      found: true,
      extinguisher: {
        id: extinguisher.id,
        internalCode: extinguisher.internalCode,
        serialNumber: extinguisher.serialNumber,
        productionYear: extinguisher.productionYear,
        manufacturerId: extinguisher.manufacturerId,
        extinguisherTypeId: extinguisher.extinguisherTypeId,
        manufacturerName: extinguisher.manufacturer ? displayManufacturer(extinguisher.manufacturer) : null,
        typeName: extinguisher.type?.name ?? null,
      },
    },
    { status: 200 }
  );
}
