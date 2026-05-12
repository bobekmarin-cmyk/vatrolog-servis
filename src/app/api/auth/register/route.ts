import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientKeyFromRequest, type RateLimitResult } from "@/lib/rateLimit";
import {
  registrationRequestReceivedEmail,
  registrationRequestVendorAlertEmail,
  sendSystemMail,
} from "@/lib/systemMail";
import { getAppBaseUrl } from "@/lib/appVersion";
import { logInfo, logWarn, logError } from "@/lib/logger";
import { apiHandler } from "@/lib/apiHandler";
import { parseOrThrow } from "@/schemas";
import { z } from "zod";
import { emailSchema, longText, optionalShortText, shortText } from "@/schemas/common";
import { resolveVendorAlertInbox } from "@/lib/registrationAlert";

export const runtime = "nodejs";

/**
 * Javni zahtjev za probni pristup (vendor-approved onboarding).
 *
 * Bitno:
 *  - Ne kreiramo Company/AccountUser/trial dok platform OWNER ne odobri zahtjev.
 *  - OIB se ne validira algoritamski (obrti, udruge i dio servisa imaju OIB-ove
 *    koje ne provjeravamo automatski). Validira se duljina i da je numerički.
 *  - Lozinka se ne unosi ovdje — admin je bira kasnije kroz onboarding pozivnicu.
 */

const requestSchema = z.object({
  companyName: shortText(200),
  oib: z
    .string()
    .trim()
    .regex(/^\d{8,15}$/u, "OIB / matični broj mora sadržavati samo znamenke (8–15)."),
  street: shortText(300),
  city: shortText(100),
  postalCode: shortText(20),
  contactName: optionalShortText(150),
  contactEmail: emailSchema,
  contactPhone: optionalShortText(40),
  note: longText(2000).optional().or(z.literal("").transform(() => undefined)),
  termsAccepted: z
    .union([z.boolean(), z.literal("on"), z.literal("true")])
    .transform((v) => v === true || v === "on" || v === "true"),
});

export const POST = apiHandler(async (req: Request) => {
  const ipKey = clientKeyFromRequest(req);
  let rl: RateLimitResult = { blocked: false };
  try {
    rl = await checkRateLimit("signup", ipKey, { limit: 3, windowSec: 3600 });
  } catch (e) {
    logError("signup_rate_limit_check_failed", e, { ipKey: ipKey.slice(0, 64) });
  }
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše pokušaja. Pričekaj ${rl.retryAfterSec} s.` },
      { status: 429 },
    );
  }

  const rawBody = await req.json().catch(() => ({}));
  const parsed = parseOrThrow(requestSchema, rawBody);

  if (!parsed.termsAccepted) {
    return NextResponse.json(
      { error: "Morate prihvatiti uvjete korištenja.", fields: { termsAccepted: "Obavezno." } },
      { status: 400 },
    );
  }

  const contactEmail = parsed.contactEmail.toLowerCase();
  const oib = parsed.oib;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  // Prevent obvious duplicates: ako već postoji nepovučen zahtjev za isti OIB,
  // ne stvaramo novi nego javljamo da je zaprimljen.
  const existingPending = await prisma.registrationRequest.findFirst({
    where: { oib, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true, status: true, createdAt: true },
  });
  if (existingPending) {
    logInfo("registration_request_duplicate_oib", { oib, existingId: existingPending.id });
    return NextResponse.json({
      ok: true,
      duplicate: true,
      message:
        "Vaš zahtjev je već u obradi. Provjerite e-mail; javit ćemo se nakon pregleda. Ako trebate ubrzati, kontaktirajte podršku.",
    });
  }

  const created = await prisma.registrationRequest.create({
    data: {
      status: "PENDING",
      companyName: parsed.companyName,
      oib,
      street: parsed.street,
      city: parsed.city,
      postalCode: parsed.postalCode,
      contactName: parsed.contactName ?? null,
      contactEmail,
      contactPhone: parsed.contactPhone ?? null,
      note: parsed.note ?? null,
      ip: ipKey,
      userAgent,
    },
  });

  // Confirmation mail za podnositelja.
  const ackTpl = await registrationRequestReceivedEmail({
    companyName: parsed.companyName,
    contactName: parsed.contactName ?? null,
  });
  const ackSent = await sendSystemMail({
    to: contactEmail,
    subject: ackTpl.subject,
    html: ackTpl.html,
    text: ackTpl.text,
    kind: "OTHER",
  });
  if (!ackSent.ok) {
    logWarn("registration_request_ack_mail_failed", {
      to: contactEmail,
      error: ackSent.error,
      requestId: created.id,
    });
  }

  const vendorInbox = resolveVendorAlertInbox();
  if (vendorInbox) {
    const reviewUrl = `${getAppBaseUrl()}/platform/registration-requests/${created.id}`;
    const alertTpl = await registrationRequestVendorAlertEmail({
      reviewUrl,
      companyName: parsed.companyName,
      oib,
      contactEmail,
      contactPhone: parsed.contactPhone ?? null,
      city: parsed.city,
    });
    const alertSent = await sendSystemMail({
      to: vendorInbox,
      subject: alertTpl.subject,
      html: alertTpl.html,
      text: alertTpl.text,
      kind: "OTHER",
    });
    if (!alertSent.ok) {
      logWarn("registration_request_vendor_alert_failed", {
        to: vendorInbox,
        error: alertSent.error,
        requestId: created.id,
      });
    }
  } else if (process.env.NODE_ENV === "production") {
    logWarn("registration_request_vendor_alert_skipped", {
      hint: "Postavi VENDOR_ALERT_EMAIL (ili PLATFORM_REGISTRATION_ALERT_EMAIL / VENDOR_FROM_EMAIL)",
      requestId: created.id,
    });
  }

  logInfo("registration_request_received", {
    requestId: created.id,
    oib,
    contactEmail,
  });

  return NextResponse.json({
    ok: true,
    requestId: created.id,
    message: "Zahtjev je zaprimljen. Pregledat ćemo ga i javiti se na e-mail.",
  });
});
