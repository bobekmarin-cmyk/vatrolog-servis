import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadServiceFormCatalog } from "@/lib/serviceFormData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Katalog dijelova i dodatnih usluga za izbornike servisne forme. Odvojen od
 * `service-form` da se drawer otvara bez čekanja na pune liste.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { id, itemId } = await params;

  const result = await loadServiceFormCatalog({
    companyId: session.companyId,
    orderId: id,
    itemId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
