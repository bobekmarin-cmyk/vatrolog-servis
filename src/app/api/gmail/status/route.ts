import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { gmailEmail: true, gmailConnectedAt: true },
  });

  return NextResponse.json({
    connected: !!company?.gmailEmail,
    email: company?.gmailEmail ?? null,
    connectedAt: company?.gmailConnectedAt ?? null,
  });
}
