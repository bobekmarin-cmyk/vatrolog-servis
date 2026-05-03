import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const companyId = sp.get("companyId") || undefined;
  const actorId = sp.get("actorId") || undefined;
  const action = sp.get("action") || undefined;
  const from = sp.get("from") || undefined;
  const to = sp.get("to") || undefined;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const where: any = {};
  if (companyId) where.companyId = companyId;
  if (actorId) where.actorId = actorId;
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        company: { select: { id: true, name: true, serviceCode: true } },
        actor: { select: { id: true, username: true } },
      },
    }),
  ]);

  if (page === 1) {
    await prisma.auditLog
      .create({
        data: {
          actorType: "PLATFORM",
          action: "platform.audit.view",
          meta: { filters: { companyId, actorId, action, from, to } },
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    rows: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      company: r.company ? { id: r.company.id, name: r.company.name, serviceCode: r.company.serviceCode } : null,
      actor: r.actor ? { id: r.actor.id, username: r.actor.username } : null,
      actorType: r.actorType,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      meta: r.meta,
      ip: r.ip,
    })),
  });
}
