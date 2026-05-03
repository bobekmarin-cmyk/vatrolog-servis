import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import { DEFAULT_FEATURES, type FeatureKey } from "@/lib/companyFeatures";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId } = await params;
  const body = (await req.json()) as {
    key: string;
    field: "enabledForAdmin" | "enabledForWorkshop";
    value: boolean;
  };

  const { key, field, value } = body;
  if (!key || !field || typeof value !== "boolean") {
    return NextResponse.json({ error: "Nedostaju parametri." }, { status: 400 });
  }

  const defaults = DEFAULT_FEATURES[key as FeatureKey] ?? {
    enabledForAdmin: true,
    enabledForWorkshop: false,
  };

  const existing = await prisma.companyFeature.findUnique({
    where: { companyId_key: { companyId, key } },
  });

  const data = {
    enabledForAdmin: existing?.enabledForAdmin ?? defaults.enabledForAdmin,
    enabledForWorkshop: existing?.enabledForWorkshop ?? defaults.enabledForWorkshop,
    [field]: value,
  };

  await prisma.companyFeature.upsert({
    where: { companyId_key: { companyId, key } },
    create: { companyId, key, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}
