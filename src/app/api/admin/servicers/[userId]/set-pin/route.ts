import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Samo admin." }, { status: 403 });

  const { userId } = await params;
  const body = await req.json();
  const pin = String(body.pin ?? "").trim();

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN mora biti točno 4 znamenke." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, companyId: session.companyId },
  });
  if (!user) return NextResponse.json({ error: "Serviser nije pronađen." }, { status: 404 });

  const hashed = await bcrypt.hash(pin, 12);
  await prisma.user.update({ where: { id: userId }, data: { pin: hashed } });

  return NextResponse.json({ ok: true });
}
