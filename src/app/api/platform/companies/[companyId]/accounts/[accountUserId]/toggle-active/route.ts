import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";

import { redirectRelative } from "@/lib/httpRedirect";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string; accountUserId: string }> }
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId, accountUserId } = await params;

  const account = await prisma.accountUser.findUnique({ where: { id: accountUserId } });
  if (!account || account.companyId !== companyId) {
    return NextResponse.json({ error: "Račun nije pronađen." }, { status: 404 });
  }

  const nextActive = !account.active;
  await prisma.accountUser.update({
    where: { id: accountUserId },
    data: nextActive
      ? { active: true }
      : { active: false, currentSessionId: null, sessionsValidAfter: new Date() },
  });

  return redirectRelative(`/platform/companies/${companyId}`, 307);
}

