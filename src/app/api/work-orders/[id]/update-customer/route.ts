import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Izmjena kupca / odjeljenja / napomene na otvorenom nalogu.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { id } = await params;
  const form = await req.formData();
  const customerId = String(form.get("customerId") ?? "").trim();
  const departmentIdRaw = String(form.get("departmentId") ?? "").trim();
  const noteRaw = String(form.get("note") ?? "").trim();
  const note = noteRaw ? noteRaw.slice(0, 4000) : null;

  if (!customerId) {
    return NextResponse.json({ error: "Kupac je obavezan." }, { status: 400 });
  }

  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    select: {
      id: true,
      status: true,
      customerId: true,
      departmentId: true,
      note: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (order.status === "LOCKED") {
    return NextResponse.json({ error: "Nalog je zaključan." }, { status: 409 });
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json(
      { error: "Kupac nije pronađen (ili nije u tvojoj tvrtki)." },
      { status: 404 },
    );
  }

  const deptCount = await prisma.customerDepartment.count({
    where: { customerId, companyId: session.companyId },
  });

  let departmentId: string | null = null;
  if (deptCount > 0) {
    if (!departmentIdRaw) {
      return NextResponse.json(
        { error: "Kupac ima odjeljenja — odaberi odjeljenje." },
        { status: 400 },
      );
    }
    const okDept = await prisma.customerDepartment.findFirst({
      where: { id: departmentIdRaw, customerId, companyId: session.companyId },
      select: { id: true },
    });
    if (!okDept) {
      return NextResponse.json(
        { error: "Odjeljenje nije pronađeno (ili nije od odabranog kupca)." },
        { status: 404 },
      );
    }
    departmentId = okDept.id;
  }

  await prisma.workOrder.update({
    where: { id: order.id },
    data: {
      customerId,
      departmentId,
      note,
    },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "workOrder.updateCustomer",
    entity: "WorkOrder",
    entityId: order.id,
    meta: {
      from: {
        customerId: order.customerId,
        departmentId: order.departmentId,
        note: order.note,
      },
      to: {
        customerId,
        departmentId,
        note,
      },
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true });
}
