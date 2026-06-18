import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getActiveOwnerOrgId } from "@/lib/ownerOrg";
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
  const orgId = await getActiveOwnerOrgId(session.ownerId);
  const matches = await resolveOwnerExtinguishersByCode(orgId, code);

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
