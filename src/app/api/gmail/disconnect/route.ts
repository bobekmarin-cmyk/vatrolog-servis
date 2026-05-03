import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptToken, revokeToken } from "@/lib/gmail";

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { gmailRefreshToken: true },
  });

  if (company?.gmailRefreshToken) {
    try {
      const token = decryptToken(company.gmailRefreshToken);
      await revokeToken(token);
    } catch {
      // best-effort revoke
    }
  }

  await prisma.company.update({
    where: { id: session.companyId },
    data: {
      gmailAccessToken: null,
      gmailRefreshToken: null,
      gmailEmail: null,
      gmailConnectedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
