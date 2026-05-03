import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  decryptToken,
  encryptToken,
  refreshAccessToken,
  sendGmail,
} from "@/lib/gmail";
import { renderTemplateHtml, renderSubject, type RenderVars, type TemplateFields } from "@/lib/emailTemplates";
import { customerDisplayName } from "@/lib/customerDisplay";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json();
  const {
    customerId,
    toEmail: toEmailOverride,
    month,
    itemCount,
    subject: customSubject,
    body: legacyBody,
    greeting,
    bodyText,
    calloutText,
    closingText,
    templateType,
  } = payload as {
    customerId: string;
    toEmail?: string;
    month: string;
    itemCount: number;
    subject?: string;
    body?: string;
    greeting?: string;
    bodyText?: string;
    calloutText?: string;
    closingText?: string;
    templateType?: string;
  };

  if (!customerId || !month || !itemCount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: {
      name: true,
      gmailAccessToken: true,
      gmailRefreshToken: true,
      gmailEmail: true,
    },
  });

  if (!company?.gmailAccessToken || !company.gmailRefreshToken || !company.gmailEmail) {
    return NextResponse.json({ error: "Gmail nije povezan" }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true, name: true, shortName: true, email: true },
  });

  if (!customer) {
    return NextResponse.json({ error: "Kupac ne postoji" }, { status: 404 });
  }

  const recipientEmail = (toEmailOverride ?? customer.email ?? "").trim();
  if (!recipientEmail) {
    return NextResponse.json({ error: "Kupac nema email adresu" }, { status: 400 });
  }

  const [y, m] = month.split("-").map(Number);
  const monthNames = [
    "siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj",
    "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac",
  ];
  const monthLabel = `${monthNames[(m ?? 1) - 1]} ${y}`;

  const custName = customerDisplayName(customer);
  const vars: RenderVars = { mjesec: monthLabel, broj: itemCount, kupac: custName, tvrtka: company.name };

  let subject: string;
  let html: string;

  if (greeting && bodyText && calloutText && closingText) {
    subject = customSubject || `Obavijest o isteku servisa vatrogasnih aparata - ${monthLabel}`;
    const tplFields: TemplateFields = {
      type: templateType || "BEGINNING",
      label: "",
      subject,
      greeting,
      bodyText,
      calloutText,
      closingText,
      footerNote: "Ova poruka je automatski generirana iz sustava za upravljanje servisom vatrogasnih aparata.",
    };
    html = renderTemplateHtml(tplFields, vars);
  } else if (legacyBody) {
    subject = customSubject || `Obavijest o isteku servisa vatrogasnih aparata - ${monthLabel}`;
    html = legacyBody;
  } else {
    const tpl = await prisma.emailTemplate.findUnique({
      where: { companyId_type: { companyId: session.companyId, type: templateType || "BEGINNING" } },
    });

    if (tpl) {
      subject = renderSubject(tpl, vars);
      html = renderTemplateHtml(tpl, vars);
    } else {
      subject = `Obavijest o isteku servisa vatrogasnih aparata - ${monthLabel}`;
      html = `<p>Poštovani, obavještavamo vas o isteku servisa za ${itemCount} aparata.</p>`;
    }
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(company.gmailAccessToken);
  } catch {
    return NextResponse.json({ error: "Greška dekriptiranja tokena" }, { status: 500 });
  }

  async function trySend() {
    await sendGmail(accessToken, company!.gmailEmail!, recipientEmail, subject, html);
  }

  try {
    await trySend();
  } catch (e: any) {
    if (e.message?.includes("401") || e.message?.includes("403")) {
      try {
        const refreshToken = decryptToken(company.gmailRefreshToken!);
        const newTokens = await refreshAccessToken(refreshToken);
        accessToken = newTokens.access_token;

        await prisma.company.update({
          where: { id: session.companyId },
          data: { gmailAccessToken: encryptToken(accessToken) },
        });

        await trySend();
      } catch (refreshErr: any) {
        await prisma.emailLog.create({
          data: {
            companyId: session.companyId,
            customerId: customer.id,
            toEmail: recipientEmail,
            subject,
            htmlBody: html,
            month,
            itemCount,
            status: "FAILED",
            error: refreshErr.message?.slice(0, 500),
          },
        });
        return NextResponse.json({ error: "Slanje neuspješno: " + (refreshErr.message ?? "") }, { status: 500 });
      }
    } else {
      await prisma.emailLog.create({
        data: {
          companyId: session.companyId,
          customerId: customer.id,
          toEmail: recipientEmail,
          subject,
          htmlBody: html,
          month,
          itemCount,
          status: "FAILED",
          error: e.message?.slice(0, 500),
        },
      });
      return NextResponse.json({ error: "Slanje neuspješno: " + (e.message ?? "") }, { status: 500 });
    }
  }

  await prisma.emailLog.create({
    data: {
      companyId: session.companyId,
      customerId: customer.id,
      toEmail: recipientEmail,
      subject,
      htmlBody: html,
      month,
      itemCount,
      status: "SENT",
    },
  });

  return NextResponse.json({ ok: true });
}
