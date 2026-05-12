import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platformAuth";
import {
  isVendorTemplateType,
  renderVendorTemplate,
  resolveVendorTemplate,
  sampleVarsFor,
  type VendorTemplateFields,
  type VendorTemplateType,
} from "@/lib/email/vendorTemplates";
import { resolveBrandingSafe } from "@/lib/systemMail";

export const runtime = "nodejs";

type Params = { params: Promise<{ type: string }> };

type PreviewBody = {
  /** Polja koja korisnik trenutno ureduje (preview prije spremanja). */
  fields?: Partial<VendorTemplateFields> | null;
  /** Custom varijable; ako nedostaju, koriste se sample iz `VENDOR_TEMPLATE_DEFAULTS`. */
  vars?: Record<string, string> | null;
};

/**
 * POST /api/platform/email-templates/[type]/preview
 * Vrati { subject, html, text } za predani sadržaj. Bez slanja maila.
 */
export async function POST(req: Request, { params }: Params) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { type } = await params;
  if (!isVendorTemplateType(type)) return NextResponse.json({ error: "Nepoznat tip predloška." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PreviewBody;
  const branding = await resolveBrandingSafe();

  const baseResolved = await resolveVendorTemplate(type as VendorTemplateType);
  const fieldsOverride: VendorTemplateFields = {
    subject: body.fields?.subject ?? baseResolved.fields.subject,
    greeting: body.fields?.greeting ?? baseResolved.fields.greeting,
    bodyText: body.fields?.bodyText ?? baseResolved.fields.bodyText,
    calloutText: body.fields?.calloutText ?? baseResolved.fields.calloutText,
    closingText: body.fields?.closingText ?? baseResolved.fields.closingText,
    footerNote: body.fields?.footerNote === undefined ? baseResolved.fields.footerNote : body.fields.footerNote,
  };

  const sample = sampleVarsFor(type as VendorTemplateType);
  const vars = { ...sample, appName: branding.fromName, ...(body.vars ?? {}) };

  const rendered = await renderVendorTemplate({
    type: type as VendorTemplateType,
    branding,
    vars,
    fieldsOverride,
  });

  return NextResponse.json(rendered);
}
