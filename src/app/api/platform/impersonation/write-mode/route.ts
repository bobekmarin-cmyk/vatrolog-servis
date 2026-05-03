import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platformAuth";
import { prisma } from "@/lib/prisma";

const WRITE_COOKIE = "vb_impersonation_write";

export async function POST(req: Request) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean; reason?: string };
  const enabled = !!body.enabled;
  const reason = String(body.reason ?? "").trim();
  if (enabled && reason.length < 6) {
    return NextResponse.json({ error: "Potreban je razlog (min 6 znakova)." }, { status: 400 });
  }

  await prisma.auditLog.create({
    data: {
      actorType: "PLATFORM",
      action: enabled ? "company.impersonate.write.enable" : "company.impersonate.write.disable",
      entity: "Session",
      entityId: "vendor-impersonation",
      meta: { reason: reason || null },
    },
  });

  const res = NextResponse.json({ ok: true, enabled });
  if (enabled) {
    res.cookies.set(WRITE_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 30,
    });
  } else {
    res.cookies.delete(WRITE_COOKIE);
  }
  return res;
}
