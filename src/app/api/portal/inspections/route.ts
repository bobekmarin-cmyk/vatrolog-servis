import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { getOwnerSession } from "@/lib/ownerAuth";
import { ownerCanAccessExtinguisher } from "@/lib/ownerInspections";
import { resolveOwnerOrgId } from "@/lib/ownerOrg";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  extinguisherId?: string;
  companyId?: string;
  inspectedAt?: string;
  accessibilityOk?: boolean;
  markingsOk?: boolean;
  complete?: boolean;
  noDamage?: boolean;
  sealOk?: boolean;
  pressureGaugeOk?: boolean | null;
  note?: string;
  performedByName?: string;
};

/**
 * Vlasnik upisuje redovni (tromjesečni) pregled aparata. Privatno za vlasnika —
 * serviser ne vidi zapis. Pristup se provjerava preko ACTIVE veze + naloga.
 */
export const POST = apiHandler(async (req: Request) => {
  const session = await getOwnerSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const extinguisherId = String(body.extinguisherId ?? "");
  const companyId = String(body.companyId ?? "");
  if (!extinguisherId || !companyId) throw new AppValidationError("Nedostaje aparat.");

  const access = await ownerCanAccessExtinguisher(session.ownerId, companyId, extinguisherId);
  if (!access) return NextResponse.json({ error: "Nemate pristup ovom aparatu." }, { status: 404 });

  const toBool = (v: unknown) => v === true;
  const accessibilityOk = toBool(body.accessibilityOk);
  const markingsOk = toBool(body.markingsOk);
  const complete = toBool(body.complete);
  const noDamage = toBool(body.noDamage);
  const sealOk = toBool(body.sealOk);
  const pressureGaugeOk =
    body.pressureGaugeOk === true ? true : body.pressureGaugeOk === false ? false : null;

  // Rezultat je ISSUES ako bilo koja primjenjiva stavka nije u redu.
  const hasIssue =
    !accessibilityOk ||
    !markingsOk ||
    !complete ||
    !noDamage ||
    !sealOk ||
    pressureGaugeOk === false;

  let inspectedAt = new Date();
  if (body.inspectedAt) {
    const parsed = new Date(body.inspectedAt);
    if (!Number.isNaN(parsed.getTime())) {
      // Ne dopuštamo datume u budućnosti.
      inspectedAt = parsed > new Date() ? new Date() : parsed;
    }
  }

  const note = body.note?.trim() || null;
  const performedByName = body.performedByName?.trim() || null;

  const ownerOrgId = await resolveOwnerOrgId(session.ownerId);

  const created = await prisma.regularInspection.create({
    data: {
      ownerId: session.ownerId,
      ownerOrgId,
      companyId,
      extinguisherId,
      inspectedAt,
      accessibilityOk,
      markingsOk,
      complete,
      noDamage,
      sealOk,
      pressureGaugeOk,
      result: hasIssue ? "ISSUES" : "OK",
      note,
      performedByName,
    },
    select: { id: true },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId,
    actorType: "CUSTOMER_PORTAL",
    action: "owner.inspection.create",
    entity: "RegularInspection",
    entityId: created.id,
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, id: created.id, result: hasIssue ? "ISSUES" : "OK" });
});
