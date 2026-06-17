import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/ownerAuth";
import { ownerCanAccessWorkOrder } from "@/lib/ownerPortalData";
import { buildRegisterPdf } from "@/lib/pdf/workOrderDocumentBuilders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOwnerSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!(await ownerCanAccessWorkOrder(session.ownerId, id))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const built = await buildRegisterPdf(id);
  if (!built) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(built.body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${built.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
