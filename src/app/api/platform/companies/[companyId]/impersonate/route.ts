import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platformAuth";
import { prisma } from "@/lib/prisma";
import { signSessionToken } from "@/lib/auth";

import { redirectRelative } from "@/lib/httpRedirect";
const SESSION_COOKIE = "vb_session";
const IMPERSONATION_COOKIE = "vb_impersonation_mode";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId } = await params;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      accounts: {
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  if (!company) return NextResponse.json({ error: "Tvrtka nije pronađena." }, { status: 404 });
  const admin = company.accounts[0];
  if (!admin) {
    return NextResponse.json(
      { error: "Tvrtka nema ADMIN račun za impersonation." },
      { status: 409 },
    );
  }
  if (!admin.active) {
    await prisma.accountUser.update({
      where: { id: admin.id },
      data: { active: true },
    });
  }

  const token = await signSessionToken({
    accountUserId: admin.id,
    companyId: company.id,
    role: "ADMIN",
    setupComplete: true,
    activeUntilTs: company.activeUntil ? company.activeUntil.getTime() : 0,
    blocked: company.blocked,
    isVendorImpersonation: true,
    serviceLocationId: null,
  });

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      actorType: "PLATFORM",
      action: "company.impersonate.start",
      entity: "Company",
      entityId: company.id,
      meta: {
        adminAccountId: admin.id,
        platformUserId: ps.platformUserId,
        readonlyDefault: true,
      },
    },
  });

  const res = redirectRelative("/dashboard", 303);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h max; middleware enforces read-only mode
  });
  res.cookies.set(IMPERSONATION_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
