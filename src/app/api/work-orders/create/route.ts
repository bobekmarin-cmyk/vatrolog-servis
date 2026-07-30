import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { makeOrderNumber, ymKey } from "@/lib/numbers";
import { ReceiptDeliveryMode } from "@prisma/client";
import { apiErrorMessage } from "@/lib/apiErrors";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

import { redirectRelative } from "@/lib/httpRedirect";
function parseDate(value: string | null) {
  if (!value) return null;
  const v = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const dot = /^(\d{2})\.(\d{2})\.(\d{4})\.?$/.exec(v);
  if (!iso && !dot) return null;
  const y = Number(iso ? iso[1] : dot![3]);
  const mo = Number(iso ? iso[2] : dot![2]) - 1;
  const dNum = Number(iso ? iso[3] : dot![1]);
  const d = new Date(y, mo, dNum, 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  const wantsJson = (req.headers.get("accept") ?? "").includes("application/json");

  const form = await req.formData();

  const customerId = String(form.get("customerId") ?? "").trim();
  const departmentId = String(form.get("departmentId") ?? "").trim();
  const deliveryModeStr = String(form.get("deliveryMode") ?? "").trim();
  const serviceLocationId = String(form.get("serviceLocationId") ?? "").trim();
  const receivedAtStr = String(form.get("receivedAt") ?? "");
  const dueAtStr = String(form.get("dueAt") ?? "");
  const countStr = String(form.get("count") ?? form.get("baseReceivedQty") ?? form.get("receivedQty") ?? "");
  const note = String(form.get("note") ?? "").trim();

  if (!customerId) {
    return NextResponse.json({ error: "Kupac je obavezan." }, { status: 400 });
  }
  if (!serviceLocationId) {
    return NextResponse.json({ error: "Servisna lokacija je obavezna." }, { status: 400 });
  }

  const receivedAt = parseDate(receivedAtStr);
  if (!receivedAt) {
    return NextResponse.json({ error: "Datum primitka je obavezan." }, { status: 400 });
  }

  const dueAt = parseDate(dueAtStr) ?? new Date(receivedAt.getTime() + 5 * 24 * 60 * 60 * 1000);
  if (dueAt.getTime() < receivedAt.getTime()) {
    return NextResponse.json(
      { error: "Datum završetka ne može biti prije datuma primitka." },
      { status: 400 },
    );
  }

  const count = Number(countStr);
  if (!Number.isFinite(count) || count < 0 || count > 500) {
    return NextResponse.json({ error: "Količina mora biti broj između 0 i 500." }, { status: 400 });
  }
  const countInt = Math.floor(count);

  let result: {
    workOrderId: string;
    orderNumber: string;
    deduplicated: boolean;
    deliveryModePersist: ReceiptDeliveryMode | null;
  };
  try {
    result = await prisma.$transaction(async (tx) => {
      const location = await tx.companyServiceLocation.findFirst({
        where: {
          id: serviceLocationId,
          companyId: session.companyId,
          active: true,
          accounts: { some: { role: "WORKSHOP", active: true } },
        },
        select: { id: true, kind: true },
      });
      if (!location) {
        throw new Error("SERVICE_LOCATION_INVALID");
      }

      if (session.role === "WORKSHOP") {
        if (!session.serviceLocationId) {
          throw new Error("WORKSHOP_NO_SERVICE_LOCATION");
        }
        if (location.id !== session.serviceLocationId) {
          throw new Error("SERVICE_LOCATION_FORBIDDEN");
        }
      }

      let deliveryModePersist: ReceiptDeliveryMode | null = null;
      if (location.kind === "STATIONARY") {
        if (deliveryModeStr !== "SERVISER" && deliveryModeStr !== "CUSTOMER") {
          throw new Error("DELIVERY_MODE_REQUIRED");
        }
        deliveryModePersist =
          deliveryModeStr === "SERVISER"
            ? ReceiptDeliveryMode.SERVISER
            : ReceiptDeliveryMode.CUSTOMER;
      } else {
        deliveryModePersist = null;
      }

      const customer = await tx.customer.findFirst({
        where: { id: customerId, companyId: session.companyId },
        select: { id: true },
      });
      if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

      const deptCount = await tx.customerDepartment.count({
        where: { customerId, companyId: session.companyId },
      });

      if (deptCount > 0) {
        if (!departmentId) throw new Error("DEPARTMENT_REQUIRED");
        const okDept = await tx.customerDepartment.findFirst({
          where: { id: departmentId, customerId, companyId: session.companyId },
          select: { id: true },
        });
        if (!okDept) throw new Error("DEPARTMENT_NOT_FOUND");
      }

      const dedupCutoff = new Date(Date.now() - 5_000);
      const recentDuplicate = await tx.workOrder.findFirst({
        where: {
          companyId: session.companyId,
          customerId,
          departmentId: departmentId || null,
          deliveryMode: deliveryModePersist,
          serviceLocationId: location.id,
          receivedQty: Math.floor(count),
          receivedAt,
          createdAt: { gte: dedupCutoff },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, orderNumber: true },
      });
      if (recentDuplicate) {
        return {
          workOrderId: recentDuplicate.id,
          orderNumber: recentDuplicate.orderNumber,
          deduplicated: true,
          deliveryModePersist,
        };
      }

      const ymk = ymKey(receivedAt);
      const yy = ymk.slice(2, 4);
      const mm = ymk.slice(5, 7);
      const prefix = `${yy}-${mm}-`;

      const last = await tx.workOrder.findFirst({
        where: { companyId: session.companyId, orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });

      let nextSeq = 1;
      if (last?.orderNumber) {
        const parts = last.orderNumber.split("-");
        const lastSeq = Number(parts[2] ?? "0");
        if (Number.isFinite(lastSeq) && lastSeq > 0) nextSeq = lastSeq + 1;
      }

      const orderNumber = makeOrderNumber(receivedAt, nextSeq);

      const workOrder = await tx.workOrder.create({
        data: {
          companyId: session.companyId,
          orderNumber,
          status: "IN_PROGRESS",
          customerId,
          departmentId: departmentId || null,
          receivedAt,
          dueAt,
          deliveryMode: deliveryModePersist,
          serviceLocationId: location.id,
          createdByAccountUserId: session.accountUserId,
          receivedQty: countInt,
          note: note || null,
          startedAt: receivedAt,
        },
        select: { id: true, orderNumber: true },
      });

      if (countInt > 0) {
        const itemsData = Array.from({ length: countInt }).map(() => ({
          companyId: session.companyId,
          workOrderId: workOrder.id,
          isPlaceholder: true,
          fromInitialReceipt: true,
        }));
        await tx.workOrderItem.createMany({ data: itemsData });
        await tx.workOrderReceiptBatch.create({
          data: {
            companyId: session.companyId,
            workOrderId: workOrder.id,
            receivedAt,
            qty: countInt,
            isInitial: true,
          },
        });
      }

      return {
        workOrderId: workOrder.id,
        orderNumber: workOrder.orderNumber,
        deduplicated: false,
        deliveryModePersist,
      };
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Kupac nije pronađen (ili nije u tvojoj tvrtki)." },
        { status: 404 },
      );
    }
    if (msg === "DEPARTMENT_REQUIRED") {
      return NextResponse.json(
        { error: "Kupac ima odjeljenja — odaberi odjeljenje." },
        { status: 400 },
      );
    }
    if (msg === "DEPARTMENT_NOT_FOUND") {
      return NextResponse.json(
        { error: "Odjeljenje nije pronađeno (ili nije od odabranog kupca)." },
        { status: 404 },
      );
    }
    if (msg === "SERVICE_LOCATION_INVALID") {
      return NextResponse.json(
        { error: "Servisna lokacija nije pronađena ili nije aktivna." },
        { status: 400 },
      );
    }
    if (msg === "SERVICE_LOCATION_FORBIDDEN") {
      return NextResponse.json(
        { error: "Ne možeš kreirati nalog za tu servisnu lokaciju." },
        { status: 403 },
      );
    }
    if (msg === "WORKSHOP_NO_SERVICE_LOCATION") {
      return NextResponse.json(
        {
          error:
            "Workshop račun nije vezan uz aktivnu servisnu lokaciju. Obrati se administratoru ili podršci.",
        },
        { status: 403 },
      );
    }
    if (msg === "DELIVERY_MODE_REQUIRED") {
      return NextResponse.json(
        { error: "Za stacionarni servis odaberi način prijenosa (kupac / serviser)." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: apiErrorMessage(e, "Greška kod kreiranja radnog naloga.") },
      { status: 500 },
    );
  }

  if (!result.deduplicated) {
    const auditMeta = extractAuditMeta(req);
    await logAudit({
      companyId: session.companyId,
      actorId: session.accountUserId,
      actorType: "ACCOUNT_USER",
      action: "workOrder.create",
      entity: "WorkOrder",
      entityId: result.workOrderId,
      meta: {
        count: countInt,
        deliveryMode: result.deliveryModePersist,
        serviceLocationId,
        orderNumber: result.orderNumber,
      },
      ip: auditMeta.ip,
      userAgent: auditMeta.userAgent,
    });
  }

  const redirectTo = `/work-orders/${result.workOrderId}`;
  if (wantsJson) {
    return NextResponse.json({ ok: true, redirectTo, deduplicated: result.deduplicated });
  }
  return redirectRelative(redirectTo, 303);
}
