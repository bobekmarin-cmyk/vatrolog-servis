import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { buildPrimkaPdf } from "@/lib/pdf/workOrderDocumentBuilders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!order) notFound();

  const built = await buildPrimkaPdf(id);
  if (!built) notFound();

  return new Response(new Uint8Array(built.body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${built.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
