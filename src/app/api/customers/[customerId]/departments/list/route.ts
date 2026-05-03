import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { customerId } = await params;
  if (!customerId) return NextResponse.json({ items: [] });

  const items = await prisma.customerDepartment.findMany({
    where: { customerId, companyId: session.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, contactPerson: true, phone: true, email: true },
  });

  return NextResponse.json({ items });
}

