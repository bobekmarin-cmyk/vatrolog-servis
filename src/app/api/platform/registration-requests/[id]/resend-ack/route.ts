import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import {
  registrationRequestReceivedEmail,
  sendSystemMail,
} from "@/lib/systemMail";
import { logInfo, logWarn } from "@/lib/logger";
import { apiHandler } from "@/lib/apiHandler";

export const runtime = "nodejs";

/**
 * Ponovo posalji potvrdni e-mail podnositelju zahtjeva ("Zahtjev je zaprimljen").
 * Koristi vendor Gmail (ili SMTP fallback) preko sendSystemMail.
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

    const tpl = await registrationRequestReceivedEmail({
      companyName: reg.companyName,
      contactName: reg.contactName ?? null,
    });
    const sent = await sendSystemMail({
      to: reg.contactEmail,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      kind: "OTHER",
      companyId: reg.companyId,
    });

    if (!sent.ok) {
      logWarn("registration_request_resend_ack_failed", {
        requestId: reg.id,
        to: reg.contactEmail,
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
        action: "registration_request.resend_ack",
        entity: "RegistrationRequest",
        entityId: reg.id,
        meta: {
          to: reg.contactEmail,
          transport: sent.transport,
          messageId: "messageId" in sent ? sent.messageId ?? null : null,
        },
      },
    });

    logInfo("registration_request_ack_resent", {
      requestId: reg.id,
      to: reg.contactEmail,
      transport: sent.transport,
    });

    return NextResponse.json({ ok: true, transport: sent.transport });
  },
);
