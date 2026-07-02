import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getActiveOwnerOrgId } from "@/lib/ownerOrg";
import { ownerCanAccessWorkOrder } from "@/lib/ownerPortalData";
import { readPdf } from "@/lib/pdfStorage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vlasniku servira arhivirani PDF IZDANOG računa (e-računi) — samo ako ima
 * ACTIVE vezu s kupcem radnog naloga. Koncepti se ne prikazuju.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOwnerSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const invoice = await prisma.workOrderInvoice.findUnique({
    where: { id },
    select: { workOrderId: true, number: true, status: true, pdfStoragePath: true },
  });
  if (!invoice || invoice.status !== "ISSUED" || !invoice.pdfStoragePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  const orgId = await getActiveOwnerOrgId(session.ownerId);
  const canAccess = await ownerCanAccessWorkOrder(orgId, invoice.workOrderId);
  if (!canAccess) return new NextResponse("Not found", { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readPdf(invoice.pdfStoragePath);
  } catch {
    return new NextResponse("PDF nije dostupan.", { status: 500 });
  }

  const filename = `racun-${(invoice.number ?? id).replaceAll("/", "-")}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
