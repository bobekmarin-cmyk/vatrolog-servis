import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logInfo, logWarn } from "@/lib/logger";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: Request) => {
  const session = await requireAdminSession();
  const companyId = session.companyId;

  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "OBRISI") {
    throw new AppValidationError(
      "Za potvrdu upišite točno OBRISI.",
      { confirm: "Upišite OBRISI za potvrdu." },
    );
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { deletedAt: new Date(), blocked: true, activeUntil: new Date() },
  });

  const meta = extractAuditMeta(req);
  await logAudit({
    companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "dsar.delete_request",
    entity: "Company",
    entityId: companyId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  logWarn("dsar_delete_requested", { companyId, actorId: session.accountUserId });
  logInfo("company_soft_deleted", { companyId });

  return NextResponse.json({ ok: true, message: "Zahtjev za brisanjem zaprimljen. Trajno brisanje izvršit će se u roku od 90 dana." });
});
