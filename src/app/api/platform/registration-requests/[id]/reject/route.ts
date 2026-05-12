import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import {
  registrationRequestRejectedEmail,
  sendSystemMail,
} from "@/lib/systemMail";
import { logInfo } from "@/lib/logger";
import { apiHandler } from "@/lib/apiHandler";
import { parseOrThrow } from "@/schemas";

export const runtime = "nodejs";

const rejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(1000, "Razlog je predug.")
    .optional()
    .nullable(),
  sendEmail: z.boolean().default(true),
});

export const POST = apiHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ps = await getPlatformSession();
    if (!ps) {
      return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = parseOrThrow(rejectSchema, body);

    const reg = await prisma.registrationRequest.findUnique({ where: { id } });
    if (!reg) {
      return NextResponse.json({ error: "Zahtjev nije pronađen." }, { status: 404 });
    }
    if (reg.status !== "PENDING") {
      return NextResponse.json(
        { error: `Zahtjev je već u stanju ${reg.status}.` },
        { status: 409 },
      );
    }

    const reason = parsed.reason?.trim() || null;

    await prisma.$transaction(async (tx) => {
      await tx.registrationRequest.update({
        where: { id: reg.id },
        data: {
          status: "REJECTED",
          rejectedAt: new Date(),
          rejectedReason: reason,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: null,
          actorType: "PLATFORM",
          action: "registration_request.reject",
          entity: "RegistrationRequest",
          entityId: reg.id,
          meta: {
            reason: reason ?? null,
            companyName: reg.companyName,
            oib: reg.oib,
            contactEmail: reg.contactEmail,
            sendEmail: parsed.sendEmail,
          },
        },
      });
    });

    let emailSent = false;
    let emailError: string | null = null;
    if (parsed.sendEmail) {
      const tpl = await registrationRequestRejectedEmail({
        companyName: reg.companyName,
        contactName: reg.contactName ?? null,
        reason,
      });
      const sent = await sendSystemMail({
        to: reg.contactEmail,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        kind: "OTHER",
      });
      emailSent = sent.ok;
      if (!sent.ok) emailError = sent.error;
    }

    logInfo("registration_request_rejected", {
      requestId: reg.id,
      reason,
      emailSent,
      emailError,
    });

    return NextResponse.json({ ok: true, emailSent, emailError });
  },
);
