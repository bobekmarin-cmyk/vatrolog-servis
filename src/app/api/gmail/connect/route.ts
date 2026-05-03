import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildConsentUrl } from "@/lib/gmail";
import crypto from "crypto";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = `${session.companyId}:${crypto.randomBytes(16).toString("hex")}`;
  const url = buildConsentUrl(state);
  return NextResponse.redirect(url);
}
