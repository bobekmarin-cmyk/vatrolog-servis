import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platformAuth";
import { getVendorStatus } from "@/lib/platformGmail";

export async function GET() {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  const status = await getVendorStatus();
  return NextResponse.json(status);
}
