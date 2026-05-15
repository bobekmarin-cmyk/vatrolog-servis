import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { issueDeliveryNoteForWorkOrder } from "@/lib/deliveryNoteIssue";
import { redirectRelative } from "@/lib/httpRedirect";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  const { id: workOrderId } = await params;

  try {
    await issueDeliveryNoteForWorkOrder({
      workOrderId,
      companyId: session.companyId,
      accountUserId: session.accountUserId,
      issueKind: "first",
    });
    return redirectRelative(`/work-orders/${workOrderId}?dn=issued_ok`, 303);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NOT_LOCKED") {
      return redirectRelative(`/work-orders/${workOrderId}?dn=not_locked`, 303);
    }
    if (msg === "ALREADY_ISSUED") {
      return redirectRelative(`/work-orders/${workOrderId}?dn=already`, 303);
    }
    return redirectRelative(`/work-orders/${workOrderId}?dn=fail`, 303);
  }
}
