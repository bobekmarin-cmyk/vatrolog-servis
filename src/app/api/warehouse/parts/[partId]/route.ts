import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Brisanje tenant-specific (vlastitog) dijela. Globalne dijelove nije moguće obrisati.
 * Brisanje je blokirano ako je dio korišten u radnim nalozima ili primkama.
 */
export const DELETE = apiHandler(
  async (req: Request, { params }: { params: Promise<{ partId: string }> }) => {
    const session = await requireActiveSession();
    const { partId } = await params;

    const part = await prisma.part.findUnique({
      where: { id: partId },
      select: {
        id: true,
        code: true,
        name: true,
        companyId: true,
        _count: {
          select: {
            usedIn: true,
            receiptItems: true,
            adjustments: true,
          },
        },
      },
    });
    if (!part || part.companyId !== session.companyId) {
      throw new AppValidationError("Dio ne postoji ili nije vaš vlastiti dio.");
    }

    if (part._count.usedIn > 0 || part._count.receiptItems > 0 || part._count.adjustments > 0) {
      throw new AppValidationError(
        "Dio je korišten u radnim nalozima, primkama ili korekcijama. Možete ga samo deaktivirati.",
      );
    }

    await prisma.part.delete({ where: { id: partId } });

    const audit = extractAuditMeta(req);
    await logAudit({
      companyId: session.companyId,
      actorId: session.accountUserId,
      actorType: "ACCOUNT_USER",
      action: "part.customDelete",
      entity: "Part",
      entityId: part.id,
      meta: { code: part.code, name: part.name },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });

    return NextResponse.json({ ok: true });
  },
);
