import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ active: z.boolean() });

/**
 * Aktivacija/deaktivacija vlastitog (tenant) dijela. Brisanje ide preko
 * `/api/warehouse/parts/[partId]` (DELETE) — to je ostavljeno za kompatibilnost.
 */
export const POST = apiHandler(
  async (req: Request, { params }: { params: Promise<{ partId: string }> }) => {
    const session = await requireAdminSession();
    const { partId } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppValidationError("Neispravan unos.");

    const part = await prisma.part.findUnique({
      where: { id: partId },
      select: { id: true, companyId: true, code: true, name: true },
    });
    if (!part || part.companyId !== session.companyId) {
      throw new AppValidationError("Dio ne postoji ili nije vaš vlastiti dio.");
    }

    const updated = await prisma.part.update({
      where: { id: partId },
      data: { active: parsed.data.active },
      select: { id: true, active: true, code: true, name: true },
    });

    const audit = extractAuditMeta(req);
    await logAudit({
      companyId: session.companyId,
      actorId: session.accountUserId,
      actorType: "ACCOUNT_USER",
      action: "part.customActiveToggle",
      entity: "Part",
      entityId: updated.id,
      meta: { code: updated.code, name: updated.name, active: updated.active },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });

    return NextResponse.json({ ok: true, active: updated.active });
  },
);
