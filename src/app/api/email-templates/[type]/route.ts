import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEMPLATE_TYPES, getDefaultTemplate, type TemplateType } from "@/lib/emailTemplates";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await params;

  if (!TEMPLATE_TYPES.includes(type as TemplateType)) {
    return NextResponse.json({ error: "Invalid template type" }, { status: 400 });
  }

  const body = await req.json();
  const { subject, greeting, bodyText, calloutText, closingText, footerNote, reset } = body as {
    subject?: string;
    greeting?: string;
    bodyText?: string;
    calloutText?: string;
    closingText?: string;
    footerNote?: string | null;
    reset?: boolean;
  };

  if (reset) {
    const defaults = getDefaultTemplate(type as TemplateType);
    const tpl = await prisma.emailTemplate.upsert({
      where: { companyId_type: { companyId: session.companyId, type } },
      create: { companyId: session.companyId, ...defaults },
      update: { ...defaults },
    });
    return NextResponse.json({ ok: true, template: tpl });
  }

  if (!subject?.trim() || !greeting?.trim() || !bodyText?.trim() || !calloutText?.trim() || !closingText?.trim()) {
    return NextResponse.json({ error: "Sva polja su obavezna" }, { status: 400 });
  }

  const defaults = getDefaultTemplate(type as TemplateType);

  const tpl = await prisma.emailTemplate.upsert({
    where: { companyId_type: { companyId: session.companyId, type } },
    create: {
      companyId: session.companyId,
      type,
      label: defaults.label,
      subject: subject.trim(),
      greeting: greeting.trim(),
      bodyText: bodyText.trim(),
      calloutText: calloutText.trim(),
      closingText: closingText.trim(),
      footerNote: footerNote?.trim() || null,
    },
    update: {
      subject: subject.trim(),
      greeting: greeting.trim(),
      bodyText: bodyText.trim(),
      calloutText: calloutText.trim(),
      closingText: closingText.trim(),
      footerNote: footerNote?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true, template: tpl });
}
