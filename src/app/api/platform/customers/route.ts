import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const companyId = sp.get("companyId") || undefined;
  const includeDeleted = sp.get("includeDeleted") === "1";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const where: Prisma.CustomerWhereInput = {};
  if (companyId) where.companyId = companyId;
  if (!includeDeleted) where.deletedAt = null;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { shortName: { contains: q, mode: "insensitive" } },
      { oib: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        company: { select: { id: true, name: true, serviceCode: true } },
      },
    }),
  ]);

  if (page === 1) {
    await prisma.auditLog
      .create({
        data: {
          actorType: "PLATFORM",
          action: "platform.customers.search",
          meta: { q, companyId, includeDeleted },
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    rows: rows.map((c) => ({
      id: c.id,
      name: c.shortName ?? c.name,
      fullName: c.name,
      oib: c.oib,
      email: c.email,
      phone: c.phone,
      city: c.city,
      deletedAt: c.deletedAt?.toISOString() ?? null,
      company: c.company,
      type: c.type,
    })),
  });
}
