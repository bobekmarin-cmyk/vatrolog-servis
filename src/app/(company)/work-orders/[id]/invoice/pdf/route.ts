import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readPdf } from "@/lib/pdfStorage";
import { redirect, notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Servira zamrznuti PDF izdanog e-računi računa za radni nalog. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const invoice = await prisma.workOrderInvoice.findFirst({
    where: { workOrderId: id, companyId: session.companyId },
    select: { number: true, pdfStoragePath: true },
  });
  if (!invoice?.pdfStoragePath) notFound();

  let buffer: Buffer;
  try {
    buffer = await readPdf(invoice.pdfStoragePath);
  } catch {
    return new Response("PDF nije dostupan.", { status: 500 });
  }

  const filename = `racun-${(invoice.number ?? id).replaceAll("/", "-")}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
