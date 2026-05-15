import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getActiveDeliveryNote } from "@/lib/deliveryNoteIssue";
import { readPdf } from "@/lib/pdfStorage";
import { buildWorkOrderPdfNames } from "@/lib/workOrderDocumentNames";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    include: { company: true, customer: true },
  });

  if (!order) notFound();

  if (order.status !== "LOCKED") {
    return new Response("Otpremnicu je moguće pregledati tek nakon zaključavanja radnog naloga.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const active = await getActiveDeliveryNote(prisma, session.companyId, order.id);
  if (!active?.pdfStoragePath) {
    return new Response(
      "Otpremnica još nije izdana. Na stranici radnog naloga kliknite „Izdaj otpremnicu“, zatim ponovno otvorite PDF ili pošaljite mail.",
      {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

  const pdfNames = buildWorkOrderPdfNames(
    {
      serviceCode: order.company.serviceCode,
      usernameSlug: order.company.usernameSlug,
    },
    {
      orderNumber: order.orderNumber,
      customer: order.customer,
    },
    "otpremnica",
  );

  let body: Buffer;
  try {
    body = await readPdf(active.pdfStoragePath);
  } catch {
    return new Response("Arhivska otpremnica nije dostupna (greška čitanja datoteke).", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const filename = pdfNames.fileName;

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
