import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTenantMailStatus } from "@/lib/tenantMail";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getTenantMailStatus(session.companyId);
  return NextResponse.json(status);
}
