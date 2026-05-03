import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId } = await params;
  const form = await req.formData();

  const key = String(form.get("key") ?? "").trim();
  if (!key) return NextResponse.json({ error: "Key je obavezan." }, { status: 400 });

  const enabledForAdmin = form.get("enabledForAdmin") === "on";
  const enabledForWorkshop = form.get("enabledForWorkshop") === "on";

  await prisma.companyFeature.upsert({
    where: { companyId_key: { companyId, key } },
    create: { companyId, key, enabledForAdmin, enabledForWorkshop },
    update: { enabledForAdmin, enabledForWorkshop },
  });

  return NextResponse.redirect(new URL(`/platform/companies/${companyId}/features`, req.url));
}

