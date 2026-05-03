import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = await req.json();
  const servicerId = String(body.servicerId ?? "");

  if (!servicerId) {
    return NextResponse.json({ error: "Potreban je ID servisera." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: servicerId, companyId: session.companyId },
  });

  if (!user) return NextResponse.json({ error: "Serviser nije pronađen." }, { status: 404 });

  await prisma.user.update({
    where: { id: servicerId },
    data: { activatedAt: null },
  });

  return NextResponse.json({ ok: true });
}
