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
import { resolveBrandingSafe, sendSystemMail } from "@/lib/systemMail";
import { logInfo } from "@/lib/logger";

export const runtime = "nodejs";

type Params = { params: Promise<{ type: string }> };

type TestBody = {
  to: string;
  /** Polja koja korisnik trenutno uredjuje — ako nije zadano, koristi se trenutno spremljeno (override ili default). */
  fields?: Partial<VendorTemplateFields> | null;
};

/**
 * POST /api/platform/email-templates/[type]/test
 * Posalje testni mail s sample varijablama na zadanu adresu.
 */
export async function POST(req: Request, { params }: Params) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { type } = await params;
  if (!isVendorTemplateType(type)) return NextResponse.json({ error: "Nepoznat tip predloska." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as TestBody;
  const to = String(body.to ?? "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Email adresa nije ispravna." }, { status: 400 });
  }

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
  const vars = { ...sample, appName: branding.fromName };

  const rendered = await renderVendorTemplate({
    type: type as VendorTemplateType,
    branding,
    vars,
    fieldsOverride,
  });

  // Markirano "[TEST]" da primalac jasno vidi da je probni mail.
  const subject = `[TEST] ${rendered.subject}`;
  const result = await sendSystemMail({
    to,
    subject,
    html: rendered.html,
    text: rendered.text,
    kind: "OTHER",
  });

  if (!result.ok) {
    return NextResponse.json({ error: `Slanje neuspjesno: ${result.error}` }, { status: 502 });
  }

  logInfo("vendor_template_test_sent", { type, to, transport: result.transport });
  return NextResponse.json({ ok: true, transport: result.transport });
}
