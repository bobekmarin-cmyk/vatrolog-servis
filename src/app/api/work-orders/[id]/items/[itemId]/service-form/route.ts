import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadServiceFormData } from "@/lib/serviceFormData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Podaci za drawer „Servisiraj aparat”. Drawer ih prefetcha na hover pa se
 * panel otvara bez čekanja.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { id, itemId } = await params;

  const result = await loadServiceFormData({
    companyId: session.companyId,
    orderId: id,
    itemId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
