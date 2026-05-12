import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platformAuth";
import { resolveAllVendorTemplates } from "@/lib/email/vendorTemplates";

export const runtime = "nodejs";

/**
 * GET /api/platform/email-templates
 * Vraća popis svih vendor predložaka (default + override merged).
 */
export async function GET() {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const all = await resolveAllVendorTemplates();
  return NextResponse.json({
    templates: all.map((t) => ({
      type: t.def.type,
      label: t.def.label,
      description: t.def.description,
      subject: t.fields.subject,
      hasOverride: t.override !== null,
      updatedAt: t.override?.updatedAt ?? null,
      updatedBy: t.override?.updatedBy ?? null,
    })),
  });
}
