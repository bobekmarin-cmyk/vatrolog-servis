import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ manufacturerId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { manufacturerId } = await params;
  const { id } = (await req.json()) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "Nedostaje id dijela." }, { status: 400 });
  }

  const part = await prisma.part.findUnique({
    where: { id },
    select: { id: true, manufacturerId: true, companyId: true, _count: { select: { usedIn: true } } },
  });
  if (!part || part.manufacturerId !== manufacturerId || part.companyId !== null) {
    return NextResponse.json({ error: "Dio ne pripada globalnom katalogu ovog proizvođača." }, { status: 404 });
  }

  if (part._count.usedIn > 0) {
    return NextResponse.json(
      {
        error:
          "Dio je već ugrađen u neke naloge. Možeš ga samo deaktivirati, ne i obrisati.",
      },
      { status: 409 },
    );
  }

  await prisma.part.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
