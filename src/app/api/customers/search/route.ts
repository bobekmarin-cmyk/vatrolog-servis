import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ items: [] }, { status: 200 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.customer.findMany({
    where: {
      companyId: session.companyId,
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { shortName: { contains: q, mode: "insensitive" } },
        { oib: { contains: q } },
        { contactPerson: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    orderBy: { name: "asc" },
    take: 20,
    select: {
      id: true,
      name: true,
      shortName: true,
      oib: true,
      address: true,
      street: true,
      postalCode: true,
      city: true,
      contactPerson: true,
      phone: true,
    },
  });

  return NextResponse.json({ items });
}
