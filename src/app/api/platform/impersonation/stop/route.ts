import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platformAuth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  await prisma.auditLog.create({
    data: {
      actorType: "PLATFORM",
      action: "company.impersonate.stop",
      entity: "Session",
      entityId: "vendor-impersonation",
    },
  });

  const res = NextResponse.redirect(new URL("/platform/companies", req.url), 303);
  res.cookies.delete("vb_session");
  res.cookies.delete("vb_impersonation_mode");
  res.cookies.delete("vb_impersonation_write");
  return res;
}
