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
 */

import nodemailer from "nodemailer";
import { logInfo, logWarn, logError } from "@/lib/logger";
import { APP_NAME } from "@/lib/appVersion";
import { prisma } from "@/lib/prisma";
import { isVendorConnected, sendVendorGmail } from "@/lib/platformGmail";
import { resolveBranding, type ResolvedPlatformBranding } from "@/lib/platformSettings";

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

async function resolveBrandingSafe(): Promise<ResolvedPlatformBranding> {
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
   TEMPLATE HELPERS
======================= */

let cachedBranding: { value: ResolvedPlatformBranding; ts: number } | null = null;
async function brandingForTemplate(): Promise<ResolvedPlatformBranding> {
  const now = Date.now();
  if (cachedBranding && now - cachedBranding.ts < 60_000) return cachedBranding.value;
  const value = await resolveBrandingSafe();
  cachedBranding = { value, ts: now };
  return value;
}

function syncBrandingDefaults(): ResolvedPlatformBranding {
  return {
    fromName: process.env.VENDOR_FROM_NAME?.trim() ?? process.env.SMTP_FROM_NAME?.trim() ?? APP_NAME,
    fromEmail:
      process.env.VENDOR_FROM_EMAIL?.trim() ??
      process.env.SMTP_FROM_EMAIL?.trim() ??
      process.env.SMTP_USER?.trim() ??
      "no-reply@localhost",
    signatureHtml: null,
    logoUrl: null,
    brandColor: "#dc2626",
  };
}

/**
 * Dvobojni "VatroLog" naslov (Vatro u slate, Log u brand boji), s blagim
 * boldom. Za druge brandove (vendor/whitelabel) ostaje jednobojni naslov.
 */
function renderBrandTitleHtml(name: string, brandColor: string): string {
  const trimmed = name.trim();
  if (trimmed.toLowerCase() === "vatrolog") {
    return `<div style="font-weight:800;font-size:22px;letter-spacing:-0.01em;line-height:1;">`
      + `<span style="color:#0f172a;">Vatro</span>`
      + `<span style="color:${brandColor};">Log</span>`
      + `</div>`;
  }
  return `<div style="font-weight:800;font-size:22px;letter-spacing:-0.01em;color:${brandColor};">${escapeHtml(trimmed)}</div>`;
}

function shellHtml(title: string, content: string, branding: ResolvedPlatformBranding): string {
  const headerLogo = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.fromName)}" style="height:32px;display:block;margin-bottom:8px"/>`
    : "";
  const signature = branding.signatureHtml
    ? `<div style="font-size:12px;color:#475569;margin-top:16px;">${branding.signatureHtml}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="hr"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;">
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;">
<div style="border-bottom:2px solid ${branding.brandColor};padding-bottom:12px;margin-bottom:16px;">
  ${headerLogo}
  ${renderBrandTitleHtml(branding.fromName, branding.brandColor)}
</div>
${content}
${signature}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px;">
<div style="font-size:11px;color:#64748b;">Ova poruka je automatski generirana iz sustava ${escapeHtml(branding.fromName)}.</div>
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/**
 * Sync verzija predložaka koja koristi keširani branding ako je dostupan,
 * inače default iz env-a. Pozivatelji ostaju nepromijenjeni.
 */
function brandingNow(): ResolvedPlatformBranding {
  return cachedBranding?.value ?? syncBrandingDefaults();
}

export function passwordResetEmail(resetUrl: string): { subject: string; html: string; text: string } {
  const branding = brandingNow();
  const subject = `${branding.fromName} — obnova lozinke`;
  const text = `Zatražena je obnova lozinke. Postavite novu lozinku na:\n${resetUrl}\n\nLink vrijedi 30 minuta. Ako niste tražili reset, ignorirajte ovu poruku.`;
  const html = shellHtml(
    "Obnova lozinke",
    `<p>Zatražili ste obnovu lozinke za Vaš ${escapeHtml(branding.fromName)} račun.</p>
     <p><a href="${resetUrl}" style="display:inline-block;background:${branding.brandColor};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Postavi novu lozinku</a></p>
     <p style="font-size:13px;color:#64748b;">Ili otvorite ovaj link u pregledniku:<br><span style="word-break:break-all;">${escapeHtml(resetUrl)}</span></p>
     <p style="font-size:13px;color:#64748b;">Link vrijedi 30 minuta. Ako niste tražili reset, slobodno ignorirajte ovu poruku.</p>`,
    branding,
  );
  return { subject, html, text };
}

export function emailVerificationEmail(verifyUrl: string): { subject: string; html: string; text: string } {
  const branding = brandingNow();
  const subject = `${branding.fromName} — potvrda email adrese`;
  const text = `Potvrdite svoju email adresu na:\n${verifyUrl}\n\nLink vrijedi 24 sata.`;
  const html = shellHtml(
    "Potvrda email adrese",
    `<p>Dobrodošli u ${escapeHtml(branding.fromName)}!</p>
     <p>Potvrdite svoju email adresu klikom na gumb:</p>
     <p><a href="${verifyUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Potvrdi email</a></p>
     <p style="font-size:13px;color:#64748b;">Ili otvorite ovaj link:<br><span style="word-break:break-all;">${escapeHtml(verifyUrl)}</span></p>
     <p style="font-size:13px;color:#64748b;">Link vrijedi 24 sata.</p>`,
    branding,
  );
  return { subject, html, text };
}

/**
 * Pozivnica admin korisniku tvrtke za prvu aktivaciju VatroLog pristupa.
 *
 * - Predstavlja portal i objašnjava čemu služi.
 * - Listsa sve generirane usernames (admin + svi user/workshop računi).
 * - Glavni CTA: "Aktiviraj pristup" — vodi na bulk password setup formu.
 */
export function adminOnboardingEmail(input: {
  companyName: string;
  serviceCode: string;
  usernames: { admin: string; workshops: string[] };
  acceptUrl: string;
}): { subject: string; html: string; text: string } {
  const branding = brandingNow();
  const { companyName, serviceCode, usernames, acceptUrl } = input;
  const subject = `${branding.fromName} — aktivacija pristupa za ${companyName}`;

  const usernamesList = [
    `${usernames.admin} — admin`,
    ...usernames.workshops.map((u, i) => `${u} — radno mjesto ${i + 1}`),
  ];

  const text = [
    `Pozdrav,`,
    ``,
    `Vaša tvrtka ${companyName} registrirana je na ${branding.fromName} portalu.`,
    `${branding.fromName} je SaaS platforma za upravljanje servisom vatrogasnih aparata —`,
    `vodi evidenciju aparata, generira radne naloge, planira preglede, šalje obavijesti kupcima i`,
    `priprema dokumentaciju za inspekciju.`,
    ``,
    `Šifra servisa: ${serviceCode}`,
    `Generirani su ovi pristupni računi:`,
    ...usernamesList.map((line) => `  • ${line}`),
    ``,
    `Klikom na link postavljate vlastitu admin lozinku te odmah lozinke za sve user/workshop račune:`,
    acceptUrl,
    ``,
    `Link vrijedi 7 dana. Ako istekne, zatražite novi od support tima.`,
  ].join("\n");

  const usernamesHtml = usernamesList
    .map(
      (line) => `<li style="font-family:monospace;font-size:13px;color:#0f172a;">${escapeHtml(line)}</li>`,
    )
    .join("");

  const html = shellHtml(
    `Aktivacija pristupa — ${escapeHtml(companyName)}`,
    `<p>Pozdrav,</p>
     <p>Vaša tvrtka <strong>${escapeHtml(companyName)}</strong> registrirana je na <strong>${escapeHtml(branding.fromName)}</strong> portalu.</p>
     <p style="color:#475569;font-size:13px;">${escapeHtml(branding.fromName)} je SaaS platforma za upravljanje servisom vatrogasnih aparata — vodi evidenciju aparata, generira radne naloge, planira preglede, šalje obavijesti kupcima i priprema dokumentaciju za inspekciju.</p>
     <div style="background:#f1f5f9;border-radius:8px;padding:12px 16px;margin:16px 0;">
       <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Šifra servisa</div>
       <div style="font-family:monospace;font-size:18px;font-weight:700;color:${branding.brandColor};">${escapeHtml(serviceCode)}</div>
       <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 4px;">Pristupni računi</div>
       <ul style="margin:0;padding-left:18px;">${usernamesHtml}</ul>
     </div>
     <p>Klikom na gumb postavljate <strong>vlastitu admin lozinku</strong> te odmah <strong>lozinke za sve user/workshop račune</strong> svoje tvrtke.</p>
     <p><a href="${acceptUrl}" style="display:inline-block;background:${branding.brandColor};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Aktiviraj pristup</a></p>
     <p style="font-size:13px;color:#64748b;">Ili otvorite ovaj link u pregledniku:<br><span style="word-break:break-all;">${escapeHtml(acceptUrl)}</span></p>
     <p style="font-size:13px;color:#64748b;">Link vrijedi 7 dana. Ako istekne, zatražite novi od support tima.</p>`,
    branding,
  );
  return { subject, html, text };
}

/**
 * Email adminu kad vendor doda novi sub-račun (XX-usrN) na company page.
 * Admin prima link za postavljanje lozinke novom računu.
 */
export function subaccountSetupEmail(input: {
  companyName: string;
  username: string;
  setupUrl: string;
}): { subject: string; html: string; text: string } {
  const branding = brandingNow();
  const { companyName, username, setupUrl } = input;
  const subject = `${branding.fromName} — postavi lozinku za ${username}`;
  const text = [
    `Pozdrav,`,
    ``,
    `U ${branding.fromName} portalu kreiran je novi korisnički račun za vašu tvrtku ${companyName}:`,
    `  ${username}`,
    ``,
    `Da bi račun mogao raditi, postavite mu lozinku ovdje:`,
    setupUrl,
    ``,
    `Morate biti prijavljeni kao admin iste tvrtke. Link vrijedi 7 dana.`,
  ].join("\n");

  const html = shellHtml(
    `Novi račun — ${escapeHtml(username)}`,
    `<p>Pozdrav,</p>
     <p>U <strong>${escapeHtml(branding.fromName)}</strong> portalu kreiran je novi korisnički račun za vašu tvrtku <strong>${escapeHtml(companyName)}</strong>:</p>
     <div style="background:#f1f5f9;border-radius:8px;padding:12px 16px;margin:16px 0;">
       <div style="font-family:monospace;font-size:18px;font-weight:700;color:${branding.brandColor};">${escapeHtml(username)}</div>
     </div>
     <p>Da bi se na taj račun moglo prijaviti, postavite mu lozinku:</p>
     <p><a href="${setupUrl}" style="display:inline-block;background:${branding.brandColor};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Postavi lozinku</a></p>
     <p style="font-size:13px;color:#64748b;">Ili otvorite ovaj link u pregledniku:<br><span style="word-break:break-all;">${escapeHtml(setupUrl)}</span></p>
     <p style="font-size:13px;color:#64748b;">Morate biti prijavljeni kao admin iste tvrtke. Link vrijedi 7 dana.</p>`,
    branding,
  );
  return { subject, html, text };
}

/**
 * Confirmation mail za korisnika koji je popunio "Zahtjev za pristup".
 * Ne obećavamo automatsku aktivaciju — samo da ćemo pregledati i javiti se.
 */
export function registrationRequestReceivedEmail(input: {
  companyName: string;
  contactName: string | null;
}): { subject: string; html: string; text: string } {
  const branding = brandingNow();
  const greeting = input.contactName ? `Pozdrav ${input.contactName},` : `Pozdrav,`;
  const subject = `${branding.fromName} — zahtjev za probni pristup zaprimljen`;

  const text = [
    greeting,
    ``,
    `Hvala što ste poslali zahtjev za probni pristup ${branding.fromName}-u za`,
    `subjekt ${input.companyName}.`,
    ``,
    `Pregledat ćemo podatke i javiti se u roku od 1 radnog dana. Ako odobrimo`,
    `zahtjev, dobit ćete e-mail s pozivnicom putem koje sami postavljate korisnička`,
    `imena i lozinke za svoju tvrtku te odmah krećete s 14-dnevnim probnim radom.`,
    ``,
    `Ako u međuvremenu imate pitanja, slobodno odgovorite na ovaj e-mail.`,
  ].join("\n");

  const html = shellHtml(
    `Zahtjev je zaprimljen`,
    `<p>${escapeHtml(greeting)}</p>
     <p>Hvala što ste poslali zahtjev za probni pristup <strong>${escapeHtml(branding.fromName)}</strong>-u za subjekt <strong>${escapeHtml(input.companyName)}</strong>.</p>
     <p>Pregledat ćemo podatke i javiti se u roku od <strong>1 radnog dana</strong>.</p>
     <p>Ako odobrimo zahtjev, dobit ćete e-mail s pozivnicom putem koje sami postavljate korisnička imena i lozinke za svoju tvrtku te odmah krećete s <strong>14-dnevnim probnim radom</strong>.</p>
     <p style="font-size:13px;color:#64748b;">Ako u međuvremenu imate pitanja, slobodno odgovorite na ovaj e-mail.</p>`,
    branding,
  );
  return { subject, html, text };
}

/**
 * Mail koji se šalje vendoru/podršci da postoji novi zahtjev za pregled.
 * Sadrži sve relevantne podatke i direktan link na platform detalj.
 */
export function registrationRequestVendorAlertEmail(input: {
  reviewUrl: string;
  companyName: string;
  oib: string;
  contactEmail: string;
  contactPhone: string | null;
  city: string;
}): { subject: string; html: string; text: string } {
  const branding = brandingNow();
  const subject = `[${branding.fromName}] Novi zahtjev za probni pristup — ${input.companyName}`;
  const text = [
    `Novi zahtjev za probni pristup čeka pregled.`,
    ``,
    `Tvrtka: ${input.companyName}`,
    `OIB: ${input.oib}`,
    `Grad: ${input.city}`,
    `Kontakt e-mail: ${input.contactEmail}`,
    input.contactPhone ? `Kontakt telefon: ${input.contactPhone}` : ``,
    ``,
    `Otvori detalje:`,
    input.reviewUrl,
  ]
    .filter(Boolean)
    .join("\n");

  const html = shellHtml(
    `Novi zahtjev za probni pristup`,
    `<p>Novi zahtjev čeka pregled u platformi:</p>
     <table style="border-collapse:collapse;font-size:14px;">
       <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Tvrtka:</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(input.companyName)}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;color:#64748b;">OIB:</td><td style="padding:4px 0;font-family:monospace;">${escapeHtml(input.oib)}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Grad:</td><td style="padding:4px 0;">${escapeHtml(input.city)}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Kontakt e-mail:</td><td style="padding:4px 0;">${escapeHtml(input.contactEmail)}</td></tr>
       ${input.contactPhone ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Kontakt telefon:</td><td style="padding:4px 0;">${escapeHtml(input.contactPhone)}</td></tr>` : ""}
     </table>
     <p style="margin-top:16px;"><a href="${input.reviewUrl}" style="display:inline-block;background:${branding.brandColor};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Otvori detalje</a></p>`,
    branding,
  );
  return { subject, html, text };
}

/**
 * Mail koji se šalje podnositelju kad vendor odbije zahtjev.
 * Razlog je opcionalan, koristi se kao kratko pojašnjenje.
 */
export function registrationRequestRejectedEmail(input: {
  companyName: string;
  contactName: string | null;
  reason: string | null;
}): { subject: string; html: string; text: string } {
  const branding = brandingNow();
  const greeting = input.contactName ? `Pozdrav ${input.contactName},` : `Pozdrav,`;
  const subject = `${branding.fromName} — povratna informacija o zahtjevu za probni pristup`;

  const reasonLine = input.reason?.trim()
    ? `Razlog: ${input.reason.trim()}`
    : `Ako želite više detalja, slobodno odgovorite na ovaj e-mail.`;

  const text = [
    greeting,
    ``,
    `Hvala na interesu za ${branding.fromName}.`,
    `Nažalost, zahtjev za probni pristup za subjekt ${input.companyName} ovaj put ne možemo odobriti.`,
    ``,
    reasonLine,
    ``,
    `Ako se okolnosti promijene, slobodno se ponovno javite — rado ćemo razgovarati.`,
  ].join("\n");

  const html = shellHtml(
    `Povratna informacija o zahtjevu`,
    `<p>${escapeHtml(greeting)}</p>
     <p>Hvala na interesu za <strong>${escapeHtml(branding.fromName)}</strong>.</p>
     <p>Nažalost, zahtjev za probni pristup za subjekt <strong>${escapeHtml(input.companyName)}</strong> ovaj put <strong>ne možemo odobriti</strong>.</p>
     <p style="font-size:13px;color:#475569;">${escapeHtml(reasonLine)}</p>
     <p style="font-size:13px;color:#64748b;">Ako se okolnosti promijene, slobodno se ponovno javite — rado ćemo razgovarati.</p>`,
    branding,
  );
  return { subject, html, text };
}

export function subscriptionExpiringEmail(
  companyName: string,
  daysLeft: number,
  billingUrl: string,
): { subject: string; html: string; text: string } {
  const branding = brandingNow();
  const subject = `${branding.fromName} — pretplata ističe za ${daysLeft} dana`;
  const text = `Vaša pretplata za ${companyName} ističe za ${daysLeft} dana.\nObnovite je na:\n${billingUrl}`;
  const html = shellHtml(
    `Pretplata ističe`,
    `<p>Poštovani,</p>
     <p>Vaša ${escapeHtml(branding.fromName)} pretplata za tvrtku <strong>${escapeHtml(companyName)}</strong> ističe za <strong>${daysLeft} dana</strong>.</p>
     <p>Da biste izbjegli prekid korištenja, obnovite pretplatu:</p>
     <p><a href="${billingUrl}" style="display:inline-block;background:${branding.brandColor};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Obnovi pretplatu</a></p>`,
    branding,
  );
  return { subject, html, text };
}

/**
 * Eagerly warm-up branding cache (poziva se opcionalno na boot-u).
 */
export async function warmBrandingCache(): Promise<void> {
  await brandingForTemplate();
}
