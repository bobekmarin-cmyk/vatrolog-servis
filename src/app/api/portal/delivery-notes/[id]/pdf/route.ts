import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/ownerAuth";
import { ownerCanAccessDeliveryNote } from "@/lib/ownerPortalData";
import { readPdf } from "@/lib/pdfStorage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vlasniku servira arhiviranu otpremnicu — samo ako ima ACTIVE vezu s kupcem
 * te otpremnice. Čita zamrznuti PDF iz storagea (isti kao print/mail servisera).
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOwnerSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const access = await ownerCanAccessDeliveryNote(session.ownerId, id);
  if (!access) return new NextResponse("Not found", { status: 404 });

  const note = await prisma.deliveryNote.findUnique({ where: { id }, select: { number: true } });

  let buffer: Buffer;
  try {
    buffer = await readPdf(access.pdfStoragePath);
  } catch {
    return new NextResponse("PDF nije dostupan.", { status: 500 });
  }

  const filename = `otpremnica-${(note?.number ?? id).replaceAll("/", "-")}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
