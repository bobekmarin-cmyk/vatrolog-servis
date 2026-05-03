import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { disconnectVendor, getVendorIntegration } from "@/lib/platformGmail";

export async function POST(req: NextRequest) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const before = await getVendorIntegration();
  await disconnectVendor();

  await prisma.auditLog.create({
    data: {
      actorType: "PLATFORM",
      action: "platform.gmail.disconnect",
      entity: "PlatformIntegration",
      entityId: "GMAIL",
      meta: { previousEmail: before?.email ?? null },
    },
  });

  if (req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.redirect(
    new URL("/platform/settings?tab=email&gmail=disconnected", req.url),
    303,
  );
}
