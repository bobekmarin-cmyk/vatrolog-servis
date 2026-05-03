import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler } from "@/lib/apiHandler";
import { logInfo } from "@/lib/logger";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const session = await requireAdminSession();
  const companyId = session.companyId;

  const [company, customers, extinguishers, workOrders, accountUsers, servicers] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.customer.findMany({ where: { companyId } }),
    prisma.extinguisher.findMany({ where: { companyId } }),
    prisma.workOrder.findMany({
      where: { companyId },
      include: { items: { include: { parts: true } } },
    }),
    prisma.accountUser.findMany({
      where: { companyId },
      select: { id: true, username: true, email: true, role: true, active: true, createdAt: true, lastLoginAt: true },
    }),
    prisma.user.findMany({ where: { companyId }, select: { id: true, fullName: true, active: true, createdAt: true } }),
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    company,
    accountUsers,
    servicers,
    customers,
    extinguishers,
    workOrders,
  };

  logInfo("dsar_export", { companyId, actorId: session.accountUserId });

  await logAudit({
    companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "dsar.export",
    entity: "Company",
    entityId: companyId,
  });

  const body = JSON.stringify(payload, null, 2);
  const filename = `vatrolog-dsar-${companyId}-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
