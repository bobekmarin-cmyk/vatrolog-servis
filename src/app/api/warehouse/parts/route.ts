import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  manufacturerId: z.string().min(5).max(60),
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  common: z.boolean().optional(),
  typeIds: z.array(z.string().min(5).max(60)).min(1, "Odaberite barem jedan tip aparata."),
});

/**
 * Kreira tenant-specific (vlastiti) dio. Vidljiv je isključivo tvrtki koja ga je unijela.
 */
export const POST = apiHandler(async (req: Request) => {
  const session = await requireActiveSession();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".")] = issue.message;
    }
    throw new AppValidationError("Neispravan unos.", fields);
  }

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id: parsed.data.manufacturerId },
    select: { id: true },
  });
  if (!manufacturer) throw new AppValidationError("Proizvođač ne postoji.");

  // Provjera da tipovi pripadaju proizvođaču
  const mfLinks = await prisma.manufacturerExtinguisherType.findMany({
    where: {
      manufacturerId: parsed.data.manufacturerId,
      extinguisherTypeId: { in: parsed.data.typeIds },
    },
    select: { extinguisherTypeId: true },
  });
  const validIds = new Set(mfLinks.map((x) => x.extinguisherTypeId));
  const invalid = parsed.data.typeIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    throw new AppValidationError("Neki odabrani tipovi ne pripadaju ovom proizvođaču.");
  }

  try {
    const created = await prisma.part.create({
      data: {
        manufacturerId: parsed.data.manufacturerId,
        companyId: session.companyId,
        code: parsed.data.code,
        name: parsed.data.name,
        common: !!parsed.data.common,
        active: true,
        types: {
          create: parsed.data.typeIds.map((tid) => ({ extinguisherTypeId: tid })),
        },
      },
      select: { id: true, code: true, name: true },
    });

    const audit = extractAuditMeta(req);
    await logAudit({
      companyId: session.companyId,
      actorId: session.accountUserId,
      actorType: "ACCOUNT_USER",
      action: "part.customCreate",
      entity: "Part",
      entityId: created.id,
      meta: { manufacturerId: parsed.data.manufacturerId, code: created.code, name: created.name },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      throw new AppValidationError("Već imate dio s tom šifrom za ovog proizvođača.");
    }
    throw e;
  }
});
