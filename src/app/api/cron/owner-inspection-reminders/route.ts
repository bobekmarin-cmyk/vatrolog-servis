import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardCronRequest } from "@/lib/cronAuth";
import { ownerInspectionReminderEmail, sendSystemMail } from "@/lib/systemMail";
import { getAppBaseUrl } from "@/lib/appVersion";
import { getOwnerActiveLinks, getOwnerExtinguishers } from "@/lib/ownerPortalData";
import { getOwnerInspectionStates } from "@/lib/ownerInspections";
import { logInfo, logWarn } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mjesečni podsjetnik vlasnicima aparata da određen broj njihovih aparata treba
 * redovni (tromjesečni) pregled. Šalje se prvog dana u mjesecu. Računa rokove
 * runtime iz zadnjeg pregleda (vidi `getOwnerInspectionStates`).
 */
export async function GET(req: Request): Promise<Response> {
  const denied = guardCronRequest(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const zagrebNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Zagreb" }));
  if (!force && zagrebNow.getDate() !== 1) {
    return NextResponse.json({ ok: true, skipped: "not_first_of_month" });
  }

  // Vlasnici koji se mogu prijaviti (postavljena lozinka) i imaju bar jednu ACTIVE vezu.
  const owners = await prisma.owner.findMany({
    where: {
      passwordHash: { not: null },
      links: { some: { status: "ACTIVE" } },
    },
    select: { id: true, email: true },
  });

  const baseUrl = getAppBaseUrl();
  const portalUrl = `${baseUrl}/korisnik/pregledi`;

  let sent = 0;
  let skippedNoDue = 0;

  for (const owner of owners) {
    if (!owner.email) continue;

    const links = await getOwnerActiveLinks(owner.id);
    if (links.length === 0) {
      skippedNoDue++;
      continue;
    }

    const exts = await getOwnerExtinguishers(links);
    if (exts.length === 0) {
      skippedNoDue++;
      continue;
    }

    const states = await getOwnerInspectionStates(
      owner.id,
      exts.map((e) => ({ id: e.id, lastPeriodicAt: e.lastPeriodicAt })),
    );
    const dueCount = [...states.values()].filter((s) => s.overdue).length;
    if (dueCount === 0) {
      skippedNoDue++;
      continue;
    }

    const mail = await ownerInspectionReminderEmail({ dueCount, portalUrl });
    const res = await sendSystemMail({
      to: owner.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      kind: "OWNER_INSPECTION_REMINDER",
    });
    if (res.ok) sent++;
    else logWarn("cron_owner_inspection_reminder_send_failed", { ownerId: owner.id, error: res.error });
  }

  logInfo("cron_owner_inspection_reminder_done", { sent, skippedNoDue, owners: owners.length });
  return NextResponse.json({ ok: true, sent, skippedNoDue, owners: owners.length });
}
