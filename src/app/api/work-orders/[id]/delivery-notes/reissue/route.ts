import { NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { issueDeliveryNoteForWorkOrder } from "@/lib/deliveryNoteIssue";
import { redirectRelative } from "@/lib/httpRedirect";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }
  if (!hasRole(session, "ADMIN")) {
    return NextResponse.json({ error: "Samo administrator može izdati novu otpremnicu (zamjenu)." }, { status: 403 });
  }

  const { id: workOrderId } = await params;

  try {
    await issueDeliveryNoteForWorkOrder({
      workOrderId,
      companyId: session.companyId,
      accountUserId: session.accountUserId,
      issueKind: "reissue",
    });
    return redirectRelative(`/work-orders/${workOrderId}?dn=reissued_ok`, 303);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NOT_LOCKED") {
      return redirectRelative(`/work-orders/${workOrderId}?dn=not_locked`, 303);
    }
    if (msg === "NOTHING_TO_SUPERSEDE") {
      return redirectRelative(`/work-orders/${workOrderId}?dn=no_active`, 303);
    }
    return redirectRelative(`/work-orders/${workOrderId}?dn=fail`, 303);
  }
}
