import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";

import { redirectRelative } from "@/lib/httpRedirect";
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

  await prisma.companyFeature.deleteMany({ where: { companyId, key } });

  return redirectRelative(`/platform/companies/${companyId}/features`, 307);
}

