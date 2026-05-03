import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string; accountUserId: string }> }
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId, accountUserId } = await params;

  const form = await req.formData();
  const newPassword = String(form.get("newPassword") ?? "");
  if (!newPassword) return NextResponse.json({ error: "Lozinka je obavezna." }, { status: 400 });

  const account = await prisma.accountUser.findUnique({ where: { id: accountUserId } });
  if (!account || account.companyId !== companyId) {
    return NextResponse.json({ error: "Račun nije pronađen." }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.accountUser.update({
    where: { id: accountUserId },
    data: { passwordHash },
  });

  return NextResponse.redirect(new URL(`/platform/companies/${companyId}`, req.url));
}

