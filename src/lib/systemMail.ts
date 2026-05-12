/**
 * Transactional ("system") email za auth i billing:
 *  - password reset
 *  - email verifikacija
 *  - pozivnica za team
 *  - obavijest o isteku pretplate
 *
 * Strategija slanja (prvo dostupno):
 *   1) Vendor Gmail (PlatformIntegration provider="GMAIL") — preferirano.
 *   2) SMTP (nodemailer) — fallback ako je SMTP_HOST/USER/PASS postavljen.
 *   3) Dev console log — ako ništa nije konfigurirano i NODE_ENV !== production.
 *
 * Sva slanja se loggiraju u `EmailLog` (transport: VENDOR_GMAIL|SMTP|DEV_LOG).
 *
 * Sadržaj predložaka živi u `src/lib/email/vendorTemplates.ts` (defaulti +
 * override iz `PlatformEmailTemplate`); zajednički vizualni shell je u
 * `src/lib/email/layout.ts`. Funkcije ovdje su tanki async wrapperi.
 */

import nodemailer from "nodemailer";
import { logInfo, logWarn, logError } from "@/lib/logger";
import { APP_NAME } from "@/lib/appVersion";
import { prisma } from "@/lib/prisma";
import { isVendorConnected, sendVendorGmail } from "@/lib/platformGmail";
import { resolveBranding, type ResolvedPlatformBranding } from "@/lib/platformSettings";
import { renderVendorTemplate } from "@/lib/email/vendorTemplates";

type Transporter = nodemailer.Transporter | null;

let transporter: Transporter = null;
let checkedConfig = false;

function getTransporter(): Transporter {
  if (checkedConfig) return transporter;
  checkedConfig = true;

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !user || !pass) {
    logWarn("system_mail_smtp_not_configured", {
      hint: "Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars for transactional emails fallback",
    });
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  logInfo("system_mail_smtp_configured", { host, port });
  return transporter;
}

export type SystemMailKind =
  | "PASSWORD_RESET"
  | "ACCOUNT_INVITE"
  | "EMAIL_VERIFY"
  | "SUBSCRIPTION_EXPIRY"
  | "MONTHLY_REMINDER"
  | "OTHER";

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Tip maila — koristi se u EmailLog.kind. Default "OTHER". */
  kind?: SystemMailKind;
  /** Optional: tvrtka / korisnik za audit + log korelaciju. */
  companyId?: string | null;
  accountUserId?: string | null;
};

export type SendMailResult =
  | { ok: true; transport: "VENDOR_GMAIL" | "SMTP" | "DEV_LOG"; messageId?: string }
  | { ok: false; error: string };

async function logEmail(
  input: SendMailInput,
  result:
    | { status: "SENT"; transport: "VENDOR_GMAIL" | "SMTP" | "DEV_LOG"; messageId?: string }
    | { status: "FAILED"; transport: "VENDOR_GMAIL" | "SMTP" | "DEV_LOG" | null; error: string },
): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        toEmail: input.to,
        subject: input.subject,
        htmlBody: input.html,
        kind: input.kind ?? "OTHER",
        transport: result.transport ?? null,
        messageId: "messageId" in result ? result.messageId ?? null : null,
        status: result.status,
        error: "error" in result ? result.error.slice(0, 500) : null,
        companyId: input.companyId ?? null,
        accountUserId: input.accountUserId ?? null,
      },
    });
  } catch (e) {
    logError("system_mail_log_failed", e, { to: input.to, subject: input.subject });
  }
}

export async function sendSystemMail(input: SendMailInput): Promise<SendMailResult> {
  // 1) prefer vendor Gmail
  try {
    if (await isVendorConnected()) {
      try {
        await sendVendorGmail({ to: input.to, subject: input.subject, html: input.html, text: input.text });
        logInfo("system_mail_sent", { transport: "VENDOR_GMAIL", to: input.to, subject: input.subject });
        await logEmail(input, { status: "SENT", transport: "VENDOR_GMAIL" });
        return { ok: true, transport: "VENDOR_GMAIL" };
      } catch (e: any) {
        logError("system_mail_vendor_send_failed", e, { to: input.to, subject: input.subject });
        // continue to SMTP/dev fallback
      }
    }
  } catch (e) {
    logError("system_mail_vendor_check_failed", e);
  }

  // 2) SMTP fallback
  const t = getTransporter();
  if (t) {
    try {
      const branding = await resolveBrandingSafe();
      const info = await t.sendMail({
        from: `${branding.fromName} <${branding.fromEmail}>`,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      logInfo("system_mail_sent", { transport: "SMTP", to: input.to, subject: input.subject, messageId: info.messageId });
      await logEmail(input, { status: "SENT", transport: "SMTP", messageId: info.messageId ?? undefined });
      return { ok: true, transport: "SMTP", messageId: info.messageId };
    } catch (err) {
      logError("system_mail_smtp_failed", err, { to: input.to, subject: input.subject });
      const msg = err instanceof Error ? err.message : String(err);
      await logEmail(input, { status: "FAILED", transport: "SMTP", error: msg });
      return { ok: false, error: msg };
    }
  }

  // 3) dev console fallback
  if (process.env.NODE_ENV !== "production") {
    logWarn("system_mail_dev_fallback_logging", {
      to: input.to,
      subject: input.subject,
      preview: input.text ?? input.html.slice(0, 500),
    });
    await logEmail(input, { status: "SENT", transport: "DEV_LOG" });
    return { ok: true, transport: "DEV_LOG" };
  }

  await logEmail(input, { status: "FAILED", transport: null, error: "NO_TRANSPORT_CONFIGURED" });
  return { ok: false, error: "NO_TRANSPORT_CONFIGURED" };
}

export async function resolveBrandingSafe(): Promise<ResolvedPlatformBranding> {
  try {
    return await resolveBranding();
  } catch {
    return {
      fromName: process.env.SMTP_FROM_NAME?.trim() ?? APP_NAME,
      fromEmail: process.env.SMTP_FROM_EMAIL?.trim() ?? process.env.SMTP_USER?.trim() ?? "no-reply@localhost",
      signatureHtml: null,
      logoUrl: null,
      brandColor: "#dc2626",
    };
  }
}

/* =======================
   TEMPLATE HELPERS — async wrappers
======================= */

/**
 * Pomoćnik za pripremu pozdravne linije s opcionalnim imenom kontakta.
 */
function greetingLineFor(contactName: string | null | undefined): string {
  return contactName ? `Pozdrav ${contactName},` : "Pozdrav,";
}

export async function passwordResetEmail(
  resetUrl: string,
): Promise<{ subject: string; html: string; text: string }> {
  const branding = await resolveBrandingSafe();
  return renderVendorTemplate({
    type: "PASSWORD_RESET",
    branding,
    vars: {
      appName: branding.fromName,
      resetUrl,
    },
  });
}

export async function emailVerificationEmail(
  verifyUrl: string,
): Promise<{ subject: string; html: string; text: string }> {
  const branding = await resolveBrandingSafe();
  return renderVendorTemplate({
    type: "EMAIL_VERIFICATION",
    branding,
    vars: {
      appName: branding.fromName,
      verifyUrl,
    },
  });
}

/**
 * Pozivnica admin korisniku tvrtke za prvu aktivaciju VatroLog pristupa.
 */
export async function adminOnboardingEmail(input: {
  companyName: string;
  serviceCode: string;
  usernames: { admin: string; workshops: string[] };
  acceptUrl: string;
}): Promise<{ subject: string; html: string; text: string }> {
  const branding = await resolveBrandingSafe();
  const usernamesText = [
    `${input.usernames.admin} — admin`,
    ...input.usernames.workshops.map((u, i) => `${u} — radno mjesto ${i + 1}`),
  ].join("\n");

  return renderVendorTemplate({
    type: "ADMIN_ONBOARDING",
    branding,
    vars: {
      appName: branding.fromName,
      companyName: input.companyName,
      serviceCode: input.serviceCode,
      usernamesText,
      acceptUrl: input.acceptUrl,
    },
  });
}

/**
 * Email adminu kad vendor doda novi sub-račun (XX-usrN) na company page.
 */
export async function subaccountSetupEmail(input: {
  companyName: string;
  username: string;
  setupUrl: string;
}): Promise<{ subject: string; html: string; text: string }> {
  const branding = await resolveBrandingSafe();
  return renderVendorTemplate({
    type: "SUBACCOUNT_SETUP",
    branding,
    vars: {
      appName: branding.fromName,
      companyName: input.companyName,
      username: input.username,
      setupUrl: input.setupUrl,
    },
  });
}

/**
 * Confirmation mail za korisnika koji je popunio "Zahtjev za pristup".
 */
export async function registrationRequestReceivedEmail(input: {
  companyName: string;
  contactName: string | null;
}): Promise<{ subject: string; html: string; text: string }> {
  const branding = await resolveBrandingSafe();
  return renderVendorTemplate({
    type: "REGISTRATION_REQUEST_RECEIVED",
    branding,
    vars: {
      appName: branding.fromName,
      companyName: input.companyName,
      greetingLine: greetingLineFor(input.contactName),
    },
  });
}

/**
 * Mail koji se šalje vendoru/podršci da postoji novi zahtjev za pregled.
 */
export async function registrationRequestVendorAlertEmail(input: {
  reviewUrl: string;
  companyName: string;
  oib: string;
  contactEmail: string;
  contactPhone: string | null;
  city: string;
}): Promise<{ subject: string; html: string; text: string }> {
  const branding = await resolveBrandingSafe();
  return renderVendorTemplate({
    type: "REGISTRATION_REQUEST_VENDOR_ALERT",
    branding,
    vars: {
      appName: branding.fromName,
      companyName: input.companyName,
      oib: input.oib,
      city: input.city,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone ?? "",
      reviewUrl: input.reviewUrl,
    },
  });
}

/**
 * Mail koji se šalje podnositelju kad vendor odbije zahtjev.
 */
export async function registrationRequestRejectedEmail(input: {
  companyName: string;
  contactName: string | null;
  reason: string | null;
}): Promise<{ subject: string; html: string; text: string }> {
  const branding = await resolveBrandingSafe();
  const reasonLine = input.reason?.trim()
    ? `Razlog: ${input.reason.trim()}`
    : "Ako želite više detalja, slobodno odgovorite na ovaj e-mail.";

  return renderVendorTemplate({
    type: "REGISTRATION_REQUEST_REJECTED",
    branding,
    vars: {
      appName: branding.fromName,
      companyName: input.companyName,
      greetingLine: greetingLineFor(input.contactName),
      reasonLine,
    },
  });
}

export async function subscriptionExpiringEmail(
  companyName: string,
  daysLeft: number,
  billingUrl: string,
): Promise<{ subject: string; html: string; text: string }> {
  const branding = await resolveBrandingSafe();
  return renderVendorTemplate({
    type: "SUBSCRIPTION_EXPIRING",
    branding,
    vars: {
      appName: branding.fromName,
      companyName,
      daysLeft: String(daysLeft),
      billingUrl,
    },
  });
}

/**
 * Eagerly warm-up branding cache (poziva se opcionalno na boot-u).
 */
export async function warmBrandingCache(): Promise<void> {
  await resolveBrandingSafe();
}
