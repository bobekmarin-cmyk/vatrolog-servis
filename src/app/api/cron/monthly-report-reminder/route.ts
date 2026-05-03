import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardCronRequest } from "@/lib/cronAuth";
import { sendSystemMail } from "@/lib/systemMail";
import { getAppBaseUrl } from "@/lib/appVersion";
import { APP_NAME } from "@/lib/appVersion";
import { logInfo, logWarn } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron koji prvog radnog dana u mjesecu šalje ADMIN-ima svake aktivne tvrtke
 * kratki podsjetnik da pregledaju "Plan servisa" i pošalju obavijesti
 * kupcima. Ne obavlja automatsku masovnu dostavu emaila kupcima (to radi admin
 * ručno iz /reports/monthly jer koristi Gmail OAuth tvrtke).
 */
export async function GET(req: Request): Promise<Response> {
  const denied = guardCronRequest(req);
  if (denied) return denied;

  const zagrebNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Zagreb" }));
  const dayOfMonth = zagrebNow.getDate();
  const dayOfWeek = zagrebNow.getDay();
  const firstBusinessDay = (() => {
    const first = new Date(zagrebNow.getFullYear(), zagrebNow.getMonth(), 1);
    const firstDay = first.getDay();
    if (firstDay === 6) return 3; // Saturday -> Monday
    if (firstDay === 0) return 2; // Sunday -> Monday
    return 1;
  })();

  if (dayOfMonth !== firstBusinessDay || dayOfWeek === 0 || dayOfWeek === 6) {
    return NextResponse.json({ ok: true, skipped: "not_first_business_day" });
  }

  const companies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      blocked: false,
      // aktivna pretplata ili neograničena
      OR: [{ activeUntil: null }, { activeUntil: { gte: new Date() } }],
    },
    select: {
      id: true,
      name: true,
      accounts: {
        where: { role: "ADMIN", active: true },
        select: { email: true },
      },
    },
  });

  const baseUrl = getAppBaseUrl();
  const now = zagrebNow;
  const monthNames = [
    "siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj",
    "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac",
  ];
  const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  let sent = 0;
  for (const company of companies) {
    for (const acc of company.accounts) {
      if (!acc.email) continue;

      const subject = `${APP_NAME} — podsjetnik: plan servisa za ${monthLabel}`;
      const text = `Počeo je novi mjesec. Pregledajte Plan servisa za ${monthLabel} i pošaljite obavijesti kupcima čiji aparati ističu ovaj mjesec.\n\nOtvori: ${baseUrl}/reports/monthly`;
      const html = `<!DOCTYPE html><html lang="hr"><body style="font-family:system-ui,sans-serif;color:#111;line-height:1.6;max-width:600px;margin:auto;padding:24px">
        <h2 style="margin:0 0 12px">Podsjetnik za ${monthLabel}</h2>
        <p>Poštovani,</p>
        <p>Počeo je novi mjesec. U ${APP_NAME}-u je spreman plan servisa s aparatima kojima ističe periodični pregled u <strong>${monthLabel}</strong>.</p>
        <p>Otvorite pregled i pošaljite obavijesti kupcima:</p>
        <p><a href="${baseUrl}/reports/monthly" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Otvori plan servisa</a></p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">Ova poruka je poslana automatski iz ${APP_NAME} sustava.</p>
      </body></html>`;

      const res = await sendSystemMail({ to: acc.email, subject, html, text });
      if (res.ok) sent++;
      else logWarn("cron_monthly_reminder_send_failed", { companyId: company.id, email: acc.email, error: res.error });
    }
  }

  logInfo("cron_monthly_reminder_done", { sent, companies: companies.length });
  return NextResponse.json({ ok: true, sent, companies: companies.length });
}
