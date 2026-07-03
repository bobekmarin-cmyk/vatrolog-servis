import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildConsentUrl } from "@/lib/gmail";
import { companyPlanAllows, planUpgradeMessage } from "@/lib/subscriptionPlan";
import crypto from "crypto";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await companyPlanAllows(session.companyId, "MAIL_SENDING"))) {
    return NextResponse.json({ error: planUpgradeMessage("MAIL_SENDING") }, { status: 403 });
  }

  const state = `${session.companyId}:${crypto.randomBytes(16).toString("hex")}`;
  const url = buildConsentUrl(state);
  return NextResponse.redirect(url);
}
