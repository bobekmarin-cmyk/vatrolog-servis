import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isActiveToday } from "@/lib/servicerStatus";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { companyId: session.companyId, active: true, role: "SERVISER" },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, activatedAt: true, pin: true },
  });

  const list = users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    activeToday: isActiveToday(u.activatedAt),
    hasPin: !!u.pin,
  }));

  return NextResponse.json(list);
}
