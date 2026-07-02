import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEracuniInvoiceForWorkOrder } from "@/lib/eracuniInvoiceActions";
import { redirectRelative } from "@/lib/httpRedirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  const { id: workOrderId } = await params;
  const order = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId: session.companyId },
    select: { id: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  }

  const result = await createEracuniInvoiceForWorkOrder({
    companyId: session.companyId,
    workOrderId,
    accountUserId: session.accountUserId,
  });

  const flag = result.ok ? "created_ok" : result.kind;
  return redirectRelative(`/work-orders/${workOrderId}?inv=${flag}`, 303);
}
