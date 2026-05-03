import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { FEATURE_KEYS, getCompanyFeatures, isFeatureEnabledForRole } from "@/lib/companyFeatures";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  const features = await getCompanyFeatures(session.companyId);
  const allowed = isFeatureEnabledForRole(session.role, features, FEATURE_KEYS.ADMIN_SERVICERS);
  if (!allowed) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });

  const form = await req.formData();
  const fullName = String(form.get("fullName") || "").trim();
  const pin = String(form.get("pin") || "").trim();

  if (!fullName) {
    return NextResponse.json({ error: "Ime je obavezno." }, { status: 400 });
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN mora biti točno 4 znamenke." }, { status: 400 });
  }

  const hashed = await bcrypt.hash(pin, 12);

  await prisma.user.create({
    data: {
      fullName,
      role: "SERVISER",
      active: true,
      pin: hashed,
      companyId: session.companyId,
    },
  });

  return NextResponse.redirect(new URL("/admin/settings/servicers", req.url));
}
