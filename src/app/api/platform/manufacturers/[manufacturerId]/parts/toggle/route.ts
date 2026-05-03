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
  const { id, active } = (await req.json()) as { id?: string; active?: boolean };
  if (!id || typeof active !== "boolean") {
    return NextResponse.json({ error: "Nedostaju parametri." }, { status: 400 });
  }

  const part = await prisma.part.findUnique({
    where: { id },
    select: { id: true, manufacturerId: true, companyId: true },
  });
  if (!part || part.manufacturerId !== manufacturerId || part.companyId !== null) {
    return NextResponse.json({ error: "Dio ne pripada globalnom katalogu ovog proizvođača." }, { status: 404 });
  }

  await prisma.part.update({ where: { id }, data: { active } });
  return NextResponse.json({ ok: true });
}
