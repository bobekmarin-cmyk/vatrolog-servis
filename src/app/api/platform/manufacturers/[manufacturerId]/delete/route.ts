import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { manufacturerId } = await params;

  const existing = await prisma.manufacturer.findUnique({
    where: { id: manufacturerId },
    select: { id: true, _count: { select: { extinguishers: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Proizvođač nije pronađen." }, { status: 404 });

  if (existing._count.extinguishers > 0) {
    return NextResponse.json(
      { error: `Ne može se obrisati: ${existing._count.extinguishers} aparata u bazi koristi ovog proizvođača.` },
      { status: 409 }
    );
  }

  await prisma.manufacturer.delete({ where: { id: manufacturerId } });
  return NextResponse.redirect(new URL("/platform/manufacturers", req.url), 303);
}
