import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getWeightCodeForType, previewNextInternalCode } from "@/lib/internalCode";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Niste prijavljeni." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const extinguisherTypeId = String(searchParams.get("extinguisherTypeId") || "").trim();

  if (!extinguisherTypeId) {
    return NextResponse.json({ ok: false, error: "Missing extinguisherTypeId" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { serviceCode: true },
  });
  if (!company) return NextResponse.json({ ok: false, error: "Tvrtka nije pronađena." }, { status: 500 });

  const weightCode = await getWeightCodeForType(extinguisherTypeId);
  const suggested = await previewNextInternalCode(session.companyId, company.serviceCode, weightCode);
  return NextResponse.json({ ok: true, suggested }, { status: 200 });
}
