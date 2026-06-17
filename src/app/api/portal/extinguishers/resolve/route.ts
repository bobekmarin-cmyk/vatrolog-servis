import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/ownerAuth";
import { resolveOwnerExtinguishersByCode } from "@/lib/ownerInspections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Razriješi internu oznaku (QR / ručni unos) u aparat(e) vlasnika. Vraća listu
 * jer ista oznaka može postojati kod više servisa.
 */
export async function GET(req: Request) {
  const session = await getOwnerSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const code = new URL(req.url).searchParams.get("code") ?? "";
  const matches = await resolveOwnerExtinguishersByCode(session.ownerId, code);

  return NextResponse.json({
    matches: matches.map((m) => ({
      extinguisherId: m.extinguisherId,
      companyId: m.companyId,
      internalCode: m.internalCode,
      serialNumber: m.serialNumber,
      typeCode: m.typeCode,
      manufacturerName: m.manufacturerName,
      servicerName: m.servicerName,
    })),
  });
}
