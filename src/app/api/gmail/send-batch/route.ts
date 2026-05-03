import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  decryptToken,
  encryptToken,
  refreshAccessToken,
  sendGmail,
} from "@/lib/gmail";
import {
  ensureDefaultTemplates,
  renderTemplateHtml,
  renderSubject,
  type RenderVars,
  type TemplateFields,
} from "@/lib/emailTemplates";
import { customerDisplayName } from "@/lib/customerDisplay";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json();
  const { month, customers } = payload as {
    month: string;
    customers: { customerId: string; itemCount: number; templateType: string }[];
  };

  if (!month || !customers?.length) {
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

  const templates = await ensureDefaultTemplates(session.companyId);
  const templateByType = new Map(templates.map((t) => [t.type, t]));

  const [y, m] = month.split("-").map(Number);
  const monthNames = [
    "siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj",
    "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac",
  ];
  const monthLabel = `${monthNames[(m ?? 1) - 1]} ${y}`;

  let accessToken: string;
  try {
    accessToken = decryptToken(company.gmailAccessToken);
  } catch {
    return NextResponse.json({ error: "Greška dekriptiranja tokena" }, { status: 500 });
  }

  let tokenRefreshed = false;

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const entry of customers) {
    const customer = await prisma.customer.findFirst({
      where: { id: entry.customerId, companyId: session.companyId },
      select: { id: true, name: true, shortName: true, email: true },
    });

    if (!customer || !customer.email) {
      results.push({ id: entry.customerId, ok: false, error: `Kupac ${entry.customerId} nema email` });
      continue;
    }

    const tpl = templateByType.get(entry.templateType) ?? templateByType.get("BEGINNING");
    if (!tpl) {
      results.push({ id: customer.id, ok: false, error: "Nema predloška" });
      continue;
    }

    const custName = customerDisplayName(customer);
    const vars: RenderVars = { mjesec: monthLabel, broj: entry.itemCount, kupac: custName, tvrtka: company.name };
    const subject = renderSubject(tpl as TemplateFields, vars);
    const html = renderTemplateHtml(tpl as TemplateFields, vars);

    try {
      await sendGmail(accessToken, company.gmailEmail, customer.email, subject, html);

      await prisma.emailLog.create({
        data: {
          companyId: session.companyId,
          customerId: customer.id,
          toEmail: customer.email,
          subject,
          htmlBody: html,
          month,
          itemCount: entry.itemCount,
          status: "SENT",
        },
      });

      results.push({ id: customer.id, ok: true });
    } catch (e: any) {
      if (!tokenRefreshed && (e.message?.includes("401") || e.message?.includes("403"))) {
        try {
          const refreshToken = decryptToken(company.gmailRefreshToken!);
          const newTokens = await refreshAccessToken(refreshToken);
          accessToken = newTokens.access_token;
          tokenRefreshed = true;

          await prisma.company.update({
            where: { id: session.companyId },
            data: { gmailAccessToken: encryptToken(accessToken) },
          });

          await sendGmail(accessToken, company.gmailEmail!, customer.email, subject, html);

          await prisma.emailLog.create({
            data: {
              companyId: session.companyId,
              customerId: customer.id,
              toEmail: customer.email,
              subject,
              htmlBody: html,
              month,
              itemCount: entry.itemCount,
              status: "SENT",
            },
          });

          results.push({ id: customer.id, ok: true });
          continue;
        } catch (refreshErr: any) {
          await prisma.emailLog.create({
            data: {
              companyId: session.companyId,
              customerId: customer.id,
              toEmail: customer.email,
              subject,
              htmlBody: html,
              month,
              itemCount: entry.itemCount,
              status: "FAILED",
              error: refreshErr.message?.slice(0, 500),
            },
          });
          results.push({ id: customer.id, ok: false, error: `${custName}: ${refreshErr.message}` });
          continue;
        }
      }

      await prisma.emailLog.create({
        data: {
          companyId: session.companyId,
          customerId: customer.id,
          toEmail: customer.email,
          subject,
          htmlBody: html,
          month,
          itemCount: entry.itemCount,
          status: "FAILED",
          error: e.message?.slice(0, 500),
        },
      });

      results.push({ id: customer.id, ok: false, error: `${custName}: ${e.message}` });
    }
  }

  return NextResponse.json({ ok: true, results });
}
