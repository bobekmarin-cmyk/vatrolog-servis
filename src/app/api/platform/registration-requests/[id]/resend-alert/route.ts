import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import {
  registrationRequestVendorAlertEmail,
  sendSystemMail,
} from "@/lib/systemMail";
import { getAppBaseUrl } from "@/lib/appVersion";
import { logInfo, logWarn } from "@/lib/logger";
import { apiHandler } from "@/lib/apiHandler";
import { resolveVendorAlertInbox } from "@/lib/registrationAlert";

export const runtime = "nodejs";

/**
 * Ponovo posalji vendor alert ("Novi zahtjev za probni pristup") na inbox
 * iz VENDOR_ALERT_EMAIL / PLATFORM_REGISTRATION_ALERT_EMAIL / VENDOR_FROM_EMAIL.
 */
export const POST = apiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ps = await getPlatformSession();
    if (!ps) {
      return NextResponse.json(
        { error: "Niste prijavljeni (platform)." },
        { status: 401 },
      );
    }

    const { id } = await params;
    const reg = await prisma.registrationRequest.findUnique({ where: { id } });
    if (!reg) {
      return NextResponse.json(
        { error: "Zahtjev nije pronaden." },
        { status: 404 },
      );
    }

    const vendorInbox = resolveVendorAlertInbox();
    if (!vendorInbox) {
      return NextResponse.json(
        {
          error:
            "Nije postavljena adresa za alert (VENDOR_ALERT_EMAIL / VENDOR_FROM_EMAIL).",
        },
        { status: 400 },
      );
    }

    const reviewUrl = `${getAppBaseUrl()}/platform/registration-requests/${reg.id}`;
    const tpl = await registrationRequestVendorAlertEmail({
      reviewUrl,
      companyName: reg.companyName,
      oib: reg.oib,
      contactEmail: reg.contactEmail,
      contactPhone: reg.contactPhone ?? null,
      city: reg.city,
    });
    const sent = await sendSystemMail({
      to: vendorInbox,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      kind: "OTHER",
      companyId: reg.companyId,
    });

    if (!sent.ok) {
      logWarn("registration_request_resend_alert_failed", {
        requestId: reg.id,
        to: vendorInbox,
        error: sent.error,
      });
      return NextResponse.json(
        { error: `Slanje nije uspjelo (${sent.error}).` },
        { status: 502 },
      );
    }

    await prisma.auditLog.create({
      data: {
        companyId: reg.companyId,
        actorType: "PLATFORM",
        action: "registration_request.resend_alert",
        entity: "RegistrationRequest",
        entityId: reg.id,
        meta: {
          to: vendorInbox,
          transport: sent.transport,
          messageId: "messageId" in sent ? sent.messageId ?? null : null,
        },
      },
    });

    logInfo("registration_request_alert_resent", {
      requestId: reg.id,
      to: vendorInbox,
      transport: sent.transport,
    });

    return NextResponse.json({
      ok: true,
      transport: sent.transport,
      to: vendorInbox,
    });
  },
);
