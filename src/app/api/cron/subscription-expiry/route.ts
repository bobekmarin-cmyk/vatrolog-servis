import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardCronRequest } from "@/lib/cronAuth";
import { sendSystemMail, subscriptionExpiringEmail } from "@/lib/systemMail";
import { getAppBaseUrl } from "@/lib/appVersion";
import { logInfo, logWarn } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron koji jednom dnevno šalje email adminima tvrtki
 * kojima pretplata ističe za točno 5, 3 ili 1 dan(a). Svaki interval šalje
 * se jednom po danu kako se ne bi spamalo.
 */
export async function GET(req: Request): Promise<Response> {
  const denied = guardCronRequest(req);
  if (denied) return denied;

  const now = new Date();
  const zagrebToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const todayStartUtc = new Date(`${zagrebToday}T00:00:00.000Z`);

  // Interval: 5, 3, 1 dan prije isteka.
  const thresholds = [5, 3, 1];
  let totalSent = 0;
  const results: Array<{ companyId: string; days: number; ok: boolean }> = [];

  const companies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      blocked: false,
      activeUntil: { not: null, gte: now },
    },
    select: {
      id: true,
      name: true,
      activeUntil: true,
      accounts: {
        where: { role: "ADMIN", active: true },
        select: { email: true, username: true },
      },
    },
  });

  for (const company of companies) {
    if (!company.activeUntil) continue;
    const activeUntilDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Zagreb",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(company.activeUntil);
    const activeUntilStartUtc = new Date(`${activeUntilDate}T00:00:00.000Z`);
    const msLeft = activeUntilStartUtc.getTime() - todayStartUtc.getTime();
    const daysLeft = Math.round(msLeft / (1000 * 60 * 60 * 24));
    if (!thresholds.includes(daysLeft)) continue;

    // Pošalji svim ADMIN računima koji imaju email.
    for (const acc of company.accounts) {
      if (!acc.email) continue;
      const mail = await subscriptionExpiringEmail(company.name, daysLeft, `${getAppBaseUrl()}/admin/settings/billing`);
      const res = await sendSystemMail({
        to: acc.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      results.push({ companyId: company.id, days: daysLeft, ok: res.ok });
      if (res.ok) totalSent++;
      else logWarn("cron_subscription_expiry_send_failed", { companyId: company.id, email: acc.email, error: res.error });
    }
  }

  logInfo("cron_subscription_expiry_done", { totalSent, companiesCandidates: companies.length });
  return NextResponse.json({ ok: true, totalSent, candidates: companies.length, results });
}
