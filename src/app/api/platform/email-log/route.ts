import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const companyId = sp.get("companyId") || undefined;
  const customerId = sp.get("customerId") || undefined;
  const transport = sp.get("transport") || undefined;
  const kind = sp.get("kind") || undefined;
  const status = sp.get("status") || undefined;
  const q = sp.get("q")?.trim() || "";
  const from = sp.get("from") || undefined;
  const to = sp.get("to") || undefined;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const where: any = {};
  if (companyId) where.companyId = companyId;
  if (customerId) where.customerId = customerId;
  if (transport) where.transport = transport;
  if (kind) where.kind = kind;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { toEmail: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
    ];
  }
  if (from || to) {
    where.sentAt = {};
    if (from) where.sentAt.gte = new Date(from);
    if (to) where.sentAt.lte = new Date(to);
  }

  const [total, rows] = await Promise.all([
    prisma.emailLog.count({ where }),
    prisma.emailLog.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        company: { select: { id: true, name: true, serviceCode: true } },
        customer: { select: { id: true, name: true, shortName: true } },
        accountUser: { select: { id: true, username: true } },
      },
    }),
  ]);

  if (page === 1) {
    await prisma.auditLog
      .create({
        data: {
          actorType: "PLATFORM",
          action: "platform.email-log.view",
          meta: { filters: { companyId, customerId, transport, kind, status, q, from, to } },
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
      sentAt: r.sentAt.toISOString(),
      company: r.company ? { id: r.company.id, name: r.company.name, serviceCode: r.company.serviceCode } : null,
      customer: r.customer ? { id: r.customer.id, name: r.customer.shortName ?? r.customer.name } : null,
      accountUser: r.accountUser,
      toEmail: r.toEmail,
      subject: r.subject,
      kind: r.kind,
      transport: r.transport,
      status: r.status,
      error: r.error,
    })),
  });
}
