import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { getPrimkaIssueStatus, issuePrimka, readIssuedPrimkaPdf } from "@/lib/primkaIssue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Otvori izdanu primku.
 * - `?issue=<id>` → konkretna verzija
 * - bez parametra → zadnja izdana; ako nema nijedne, izdaj prvu;
 *   ako se sadržaj promijenio od zadnje, i dalje otvori zadnju (nova se izdaje
 *   eksplicitno preko Dokumenti → Izdaj novu primku).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!order) notFound();

  const url = new URL(req.url);
  const issueId = url.searchParams.get("issue")?.trim() || null;
  const forceNew = url.searchParams.get("issueNew") === "1";

  try {
    if (issueId) {
      const owned = await prisma.workOrderPrimkaIssue.findFirst({
        where: { id: issueId, workOrderId: id, companyId: session.companyId },
        select: { id: true, filename: true },
      });
      if (!owned) notFound();
      const body = await readIssuedPrimkaPdf(owned.id);
      return new Response(new Uint8Array(body), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${owned.filename ?? "primka.pdf"}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const status = await getPrimkaIssueStatus(id);

    if (forceNew) {
      if (!status.canIssueNew) {
        return Response.json(
          { error: "Nema novih podataka za novu primku." },
          { status: 409 },
        );
      }
      const issued = await issuePrimka(id);
      return new Response(new Uint8Array(issued.body), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${issued.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (status.latest) {
      const body = await readIssuedPrimkaPdf(status.latest.id);
      return new Response(new Uint8Array(body), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${status.latest.filename ?? "primka.pdf"}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Prva primka — izdaj automatski.
    const issued = await issuePrimka(id);
    return new Response(new Uint8Array(issued.body), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${issued.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    notFound();
  }
}
