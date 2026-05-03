import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { FEATURE_KEYS, getCompanyFeatures, isFeatureEnabledForRole } from "@/lib/companyFeatures";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  const features = await getCompanyFeatures(session.companyId);
  const allowed = isFeatureEnabledForRole(session.role, features, FEATURE_KEYS.ADMIN_SERVICERS);
  if (!allowed) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });

  const { userId } = await params;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Korisnik nije pronađen." }, { status: 404 });
  if (user.companyId !== session.companyId) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });

  await prisma.user.update({
    where: { id: userId },
    data: { active: !user.active },
  });

  return NextResponse.redirect(new URL("/admin/settings/servicers", req.url));
}
