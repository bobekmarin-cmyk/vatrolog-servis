import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import {
  isVendorTemplateType,
  resolveVendorTemplate,
  VENDOR_TEMPLATE_DEFAULTS,
  type VendorTemplateType,
} from "@/lib/email/vendorTemplates";

export const runtime = "nodejs";

const MAX_FIELD_LENGTH: Record<string, number> = {
  subject: 200,
  greeting: 500,
  bodyText: 4000,
  calloutText: 1000,
  closingText: 1000,
  footerNote: 500,
};

type Params = { params: Promise<{ type: string }> };

/**
 * GET /api/platform/email-templates/[type]
 * Vraća resolviran predložak (default + override) + popis varijabli.
 */
export async function GET(_req: Request, { params }: Params) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { type } = await params;
  if (!isVendorTemplateType(type)) return NextResponse.json({ error: "Nepoznat tip predloška." }, { status: 404 });

  const resolved = await resolveVendorTemplate(type);
  return NextResponse.json({
    type: resolved.def.type,
    label: resolved.def.label,
    description: resolved.def.description,
    fields: resolved.fields,
    defaults: resolved.def.fields,
    variables: resolved.def.variables,
    hasOverride: resolved.override !== null,
    updatedAt: resolved.override?.updatedAt ?? null,
    updatedBy: resolved.override?.updatedBy ?? null,
  });
}

type PutBody = {
  subject?: string;
  greeting?: string;
  bodyText?: string;
  calloutText?: string;
  closingText?: string;
  footerNote?: string | null;
};

/**
 * PUT /api/platform/email-templates/[type]
 * Upsert override za zadani tip. Sva polja su obvezna osim `footerNote`.
 */
export async function PUT(req: Request, { params }: Params) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { type } = await params;
  if (!isVendorTemplateType(type)) return NextResponse.json({ error: "Nepoznat tip predloška." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PutBody;

  const fieldsToValidate = {
    subject: trimToLimit(body.subject, MAX_FIELD_LENGTH.subject),
    greeting: trimToLimit(body.greeting, MAX_FIELD_LENGTH.greeting),
    bodyText: trimToLimit(body.bodyText, MAX_FIELD_LENGTH.bodyText),
    calloutText: trimToLimit(body.calloutText, MAX_FIELD_LENGTH.calloutText),
    closingText: trimToLimit(body.closingText, MAX_FIELD_LENGTH.closingText),
    footerNote:
      body.footerNote === null || body.footerNote === undefined || String(body.footerNote).trim() === ""
        ? null
        : trimToLimit(body.footerNote, MAX_FIELD_LENGTH.footerNote),
  };

  const required = ["subject", "greeting", "bodyText", "calloutText", "closingText"] as const;
  for (const field of required) {
    if (!fieldsToValidate[field]) {
      return NextResponse.json({ error: `Polje "${field}" je obavezno.` }, { status: 400 });
    }
  }

  const def = VENDOR_TEMPLATE_DEFAULTS[type as VendorTemplateType];
  await prisma.platformEmailTemplate.upsert({
    where: { type },
    create: {
      type,
      label: def.label,
      ...fieldsToValidate,
      updatedBy: ps.platformUserId,
    },
    update: {
      label: def.label,
      ...fieldsToValidate,
      updatedBy: ps.platformUserId,
    },
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/platform/email-templates/[type]
 * Briše override (ako postoji) — predložak vraća na default iz koda.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { type } = await params;
  if (!isVendorTemplateType(type)) return NextResponse.json({ error: "Nepoznat tip predloška." }, { status: 404 });

  await prisma.platformEmailTemplate.deleteMany({ where: { type } });
  return NextResponse.json({ ok: true });
}

function trimToLimit(value: unknown, limit: number): string {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  return s.slice(0, limit);
}
