import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setTenantDisplayName } from "@/lib/tenantMail";

const MAX_LEN = 80;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { displayName?: unknown };
  try {
    body = (await req.json()) as { displayName?: unknown };
  } catch {
    return NextResponse.json({ error: "Neispravan JSON" }, { status: 400 });
  }

  const raw = typeof body.displayName === "string" ? body.displayName.trim() : "";

  if (raw.length > MAX_LEN) {
    return NextResponse.json(
      { error: `Naziv pošiljatelja smije imati najviše ${MAX_LEN} znakova.` },
      { status: 400 },
    );
  }

  await setTenantDisplayName(session.companyId, raw || null);
  return NextResponse.json({ ok: true });
}
