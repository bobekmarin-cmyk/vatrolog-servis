import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trajno brisanje aparata (admin). Oslobađa interni broj za ponovnu uporabu.
 * Stavke naloga zadržavaju snapshot podatke; veza extinguisherId se nullificira.
 */
export const POST = apiHandler(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireAdminSession();
    const { id } = await ctx.params;

    const ext = await prisma.extinguisher.findFirst({
      where: { id, companyId: session.companyId },
      select: {
        id: true,
        internalCode: true,
        serialNumber: true,
        status: true,
        manufacturerId: true,
        extinguisherTypeId: true,
        _count: {
          select: {
            workItems: true,
            regularInspections: true,
          },
        },
      },
    });
    if (!ext) throw new AppValidationError("Aparat nije pronađen.");

    const linkedItems = await prisma.workOrderItem.count({
      where: { extinguisherId: ext.id, companyId: session.companyId },
    });

    await prisma.$transaction(async (tx) => {
      await tx.workOrderItem.updateMany({
        where: { extinguisherId: ext.id, companyId: session.companyId },
        data: { extinguisherId: null },
      });
      // RegularInspection ima onDelete: Cascade
      await tx.extinguisher.delete({ where: { id: ext.id } });
    });

    const audit = extractAuditMeta(req);
    await logAudit({
      companyId: session.companyId,
      actorId: session.accountUserId,
      actorType: "ACCOUNT_USER",
      action: "extinguisher.hardDelete",
      entity: "Extinguisher",
      entityId: ext.id,
      meta: {
        internalCode: ext.internalCode,
        serialNumber: ext.serialNumber,
        status: ext.status,
        manufacturerId: ext.manufacturerId,
        extinguisherTypeId: ext.extinguisherTypeId,
        unlinkedWorkItems: linkedItems,
        regularInspections: ext._count.regularInspections,
      },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });

    return NextResponse.json({ ok: true, freedInternalCode: ext.internalCode });
  },
);
