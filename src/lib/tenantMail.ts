/**
 * Unificirani sloj za slanje mailova kupcima iz tenantovog konteksta.
 *
 * Tvrtka (Company) može imati konfigurirana dva providera za isporuku:
 *  - GMAIL  — Google OAuth integracija (gmailAccessToken/RefreshToken/Email).
 *  - SMTP   — vlastiti SMTP server (npr. info@moj-servis.hr).
 *
 * Ako su oba konfigurirana, korisnik bira aktivnog kroz `Company.mailProvider`
 * ("GMAIL" | "SMTP" | null). Null = automatski (Gmail prefer ako oba postoje).
 *
 * Sve funkcije ovdje su tanki wrapperi koji sami brinu o:
 *   - dekripciji tokena/lozinke,
 *   - refresh-anju Gmail access tokena (i perzistenciji novog),
 *   - prikazu ispravnog "From" headera,
 *   - errorima koji se uredno propagiraju upoznatom porukom za UI.
 *
 * EmailLog se NE piše ovdje — pozivatelji (npr. send-notification rute) i dalje
 * pišu vlastiti detaljni log sa svojim metapodacima (customerId, month, …).
 */

import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import {
  decryptToken,
  encryptToken,
  refreshAccessToken,
  sendGmail,
  sendGmailWithAttachment,
} from "@/lib/gmail";
import { logError, logInfo, logWarn } from "@/lib/logger";

export type MailProvider = "GMAIL" | "SMTP";

export type TenantMailStatus = {
  /** Je li bilo koji provider konfiguriran. */
  configured: boolean;
  /** Aktivni provider koji bi trenutno bio korišten za slanje. Null = nijedan. */
  activeProvider: MailProvider | null;
  /** Ekspliticno postavljen aktivni provider (može biti null = auto). */
  preferredProvider: MailProvider | null;
  /**
   * Display ime u "From" headeru, vrijedi za oba providera (Gmail i SMTP).
   * Ako je null, fallback na naziv tvrtke (Company.name).
   * Pohranjuje se u Company.smtpFromName (povijesno ime kolone, danas se koristi kao "displayName").
   */
  displayName: string | null;
  /** Naziv tvrtke (fallback za displayName). */
  companyName: string;
  gmail: {
    configured: boolean;
    email: string | null;
    connectedAt: string | null;
  };
  smtp: {
    configured: boolean;
    host: string | null;
    port: number | null;
    secure: boolean | null;
    user: string | null;
    fromEmail: string | null;
    fromName: string | null;
    connectedAt: string | null;
  };
};

export type SmtpSettingsInput = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  /** Plaintext lozinka — bit će šifrirana prije pohrane. */
  password: string;
  fromEmail?: string | null;
  fromName?: string | null;
};

export type SmtpVerifyResult =
  | { ok: true }
  | { ok: false; error: string };

/* ============================================================
 * STATUS
 * ============================================================ */

export async function getTenantMailStatus(companyId: string): Promise<TenantMailStatus> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      gmailEmail: true,
      gmailConnectedAt: true,
      gmailAccessToken: true,
      gmailRefreshToken: true,
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpPassEncrypted: true,
      smtpFromEmail: true,
      smtpFromName: true,
      smtpConnectedAt: true,
      mailProvider: true,
    },
  });

  if (!company) {
    return emptyStatus();
  }

  const gmailConfigured =
    !!company.gmailEmail && !!company.gmailAccessToken && !!company.gmailRefreshToken;
  const smtpConfigured =
    !!company.smtpHost && !!company.smtpPort && !!company.smtpUser && !!company.smtpPassEncrypted;

  const preferred = normalizePreferred(company.mailProvider);
  const active = pickActiveProvider({ gmailConfigured, smtpConfigured, preferred });

  return {
    configured: gmailConfigured || smtpConfigured,
    activeProvider: active,
    preferredProvider: preferred,
    displayName: company.smtpFromName?.trim() || null,
    companyName: company.name ?? "",
    gmail: {
      configured: gmailConfigured,
      email: company.gmailEmail ?? null,
      connectedAt: company.gmailConnectedAt?.toISOString() ?? null,
    },
    smtp: {
      configured: smtpConfigured,
      host: company.smtpHost ?? null,
      port: company.smtpPort ?? null,
      secure: company.smtpSecure ?? null,
      user: company.smtpUser ?? null,
      fromEmail: company.smtpFromEmail ?? null,
      fromName: company.smtpFromName ?? null,
      connectedAt: company.smtpConnectedAt?.toISOString() ?? null,
    },
  };
}

function emptyStatus(): TenantMailStatus {
  return {
    configured: false,
    activeProvider: null,
    preferredProvider: null,
    displayName: null,
    companyName: "",
    gmail: { configured: false, email: null, connectedAt: null },
    smtp: {
      configured: false,
      host: null,
      port: null,
      secure: null,
      user: null,
      fromEmail: null,
      fromName: null,
      connectedAt: null,
    },
  };
}

/**
 * Postavlja "Naziv pošiljatelja" za tenant — vrijedi kao display name
 * u "From" headeru za Gmail i SMTP. Reciklira `Company.smtpFromName`.
 * `displayName=null` znači "vrati na default = naziv tvrtke".
 */
export async function setTenantDisplayName(
  companyId: string,
  displayName: string | null,
): Promise<void> {
  const value = displayName?.trim();
  await prisma.company.update({
    where: { id: companyId },
    data: { smtpFromName: value && value.length > 0 ? value : null },
  });
  invalidateTransporter(companyId);
}

function normalizePreferred(raw: string | null | undefined): MailProvider | null {
  if (raw === "GMAIL" || raw === "SMTP") return raw;
  return null;
}

function pickActiveProvider(input: {
  gmailConfigured: boolean;
  smtpConfigured: boolean;
  preferred: MailProvider | null;
}): MailProvider | null {
  const { gmailConfigured, smtpConfigured, preferred } = input;
  if (preferred === "GMAIL" && gmailConfigured) return "GMAIL";
  if (preferred === "SMTP" && smtpConfigured) return "SMTP";
  // auto-fallback: ako preferred ne postoji ili nije konfiguriran, biraj što imaš
  if (gmailConfigured) return "GMAIL";
  if (smtpConfigured) return "SMTP";
  return null;
}

/* ============================================================
 * SET / RESET ACTIVE PROVIDER
 * ============================================================ */

export async function setActiveTenantMailProvider(
  companyId: string,
  provider: MailProvider | null,
): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: { mailProvider: provider },
  });
}

/* ============================================================
 * SMTP — VERIFY / SAVE / DELETE
 * ============================================================ */

export async function verifySmtpSettings(
  input: Pick<SmtpSettingsInput, "host" | "port" | "secure" | "user" | "password">,
): Promise<SmtpVerifyResult> {
  const t = nodemailer.createTransport({
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: { user: input.user, pass: input.password },
    // Razuman timeout da korisnik ne čeka 30+ sekundi na pogrešnom hostu.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  try {
    await t.verify();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  } finally {
    try {
      t.close();
    } catch {
      // ignore
    }
  }
}

export async function saveSmtpSettings(
  companyId: string,
  input: SmtpSettingsInput,
): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: {
      smtpHost: input.host,
      smtpPort: input.port,
      smtpSecure: input.secure,
      smtpUser: input.user,
      smtpPassEncrypted: encryptToken(input.password),
      smtpFromEmail: input.fromEmail?.trim() || null,
      smtpFromName: input.fromName?.trim() || null,
      smtpConnectedAt: new Date(),
    },
  });
  invalidateTransporter(companyId);
}

export async function deleteSmtpSettings(companyId: string): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: {
      smtpHost: null,
      smtpPort: null,
      smtpSecure: null,
      smtpUser: null,
      smtpPassEncrypted: null,
      smtpFromEmail: null,
      smtpFromName: null,
      smtpConnectedAt: null,
      // Ako je SMTP bio aktivan provider, ostavi mailProvider null da se padne na Gmail/auto.
      mailProvider: null,
    },
  });
  invalidateTransporter(companyId);
}

/* ============================================================
 * SMTP — TRANSPORTER CACHE
 * ============================================================ */

type CachedTransporter = {
  transporter: Transporter;
  fromAddress: string;
};

const transporterCache = new Map<string, CachedTransporter>();

function invalidateTransporter(companyId: string): void {
  const cached = transporterCache.get(companyId);
  if (cached) {
    try {
      cached.transporter.close();
    } catch {
      // ignore
    }
  }
  transporterCache.delete(companyId);
}

async function getCompanySmtpTransporter(
  companyId: string,
): Promise<{ transporter: Transporter; fromAddress: string } | null> {
  const cached = transporterCache.get(companyId);
  if (cached) return cached;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpPassEncrypted: true,
      smtpFromEmail: true,
      smtpFromName: true,
    },
  });

  if (
    !company?.smtpHost ||
    !company.smtpPort ||
    !company.smtpUser ||
    !company.smtpPassEncrypted
  ) {
    return null;
  }

  let pass: string;
  try {
    pass = decryptToken(company.smtpPassEncrypted);
  } catch (err) {
    logError("tenant_smtp_decrypt_failed", err, { companyId });
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: company.smtpHost,
    port: company.smtpPort,
    secure: !!company.smtpSecure,
    auth: { user: company.smtpUser, pass },
  });

  const fromName = (company.smtpFromName ?? "").trim() || company.name;
  const fromEmail = (company.smtpFromEmail ?? "").trim() || company.smtpUser;
  const fromAddress = `${fromName} <${fromEmail}>`;

  const entry = { transporter, fromAddress };
  transporterCache.set(companyId, entry);
  return entry;
}

/* ============================================================
 * SLANJE
 * ============================================================ */

export type TenantSendInput = {
  companyId: string;
  to: string;
  subject: string;
  html: string;
  /** Opcionalni text dio (multipart/alternative). */
  text?: string;
  /** Opcionalni attachment (npr. PDF upisnika ili radnog naloga). */
  attachment?: { filename: string; mimeType: string; data: Buffer };
  /** Eksplicitni provider — ako se zada, koristi se baš taj (i baca grešku ako nije konfiguriran). */
  forceProvider?: MailProvider;
};

export type TenantSendResult = {
  ok: true;
  provider: MailProvider;
  messageId?: string;
  fromAddress: string;
};

export class TenantMailNotConfiguredError extends Error {
  constructor() {
    super("Mail nije konfiguriran. Povežite Gmail ili SMTP u Postavke → Postavke maila.");
    this.name = "TenantMailNotConfiguredError";
  }
}

export class TenantMailSendError extends Error {
  provider: MailProvider;
  cause?: unknown;
  constructor(provider: MailProvider, message: string, cause?: unknown) {
    super(message);
    this.name = "TenantMailSendError";
    this.provider = provider;
    this.cause = cause;
  }
}

export async function sendTenantMail(input: TenantSendInput): Promise<TenantSendResult> {
  const status = await getTenantMailStatus(input.companyId);
  const provider = input.forceProvider ?? status.activeProvider;

  if (!provider) throw new TenantMailNotConfiguredError();

  if (provider === "GMAIL") {
    if (!status.gmail.configured) {
      throw new TenantMailNotConfiguredError();
    }
    return sendViaGmail(input);
  }

  if (!status.smtp.configured) {
    throw new TenantMailNotConfiguredError();
  }
  return sendViaSmtp(input);
}

async function sendViaGmail(input: TenantSendInput): Promise<TenantSendResult> {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: {
      gmailEmail: true,
      gmailAccessToken: true,
      gmailRefreshToken: true,
      name: true,
      smtpFromName: true,
    },
  });

  if (!company?.gmailEmail || !company.gmailAccessToken || !company.gmailRefreshToken) {
    throw new TenantMailNotConfiguredError();
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(company.gmailAccessToken);
  } catch (err) {
    throw new TenantMailSendError("GMAIL", "Greška dekriptiranja Gmail tokena", err);
  }

  // `smtpFromName` reciklira se kao zajednički "display name" za Gmail i SMTP
  // (postavlja se u Postavke → Postavke maila → polje "Naziv pošiljatelja").
  const displayName = (company.smtpFromName ?? "").trim() || company.name;
  const fromAddress = `${encodeMailDisplayName(displayName)} <${company.gmailEmail}>`;

  const send = async (token: string) => {
    if (input.attachment) {
      await sendGmailWithAttachment(
        token,
        fromAddress,
        input.to,
        input.subject,
        input.html,
        input.attachment,
      );
    } else {
      await sendGmail(token, fromAddress, input.to, input.subject, input.html);
    }
  };

  try {
    await send(accessToken);
    return { ok: true, provider: "GMAIL", fromAddress };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!(msg.includes("401") || msg.includes("403"))) {
      throw new TenantMailSendError("GMAIL", msg, err);
    }

    // Pokušaj refresh tokena i retry jednom.
    try {
      const refreshToken = decryptToken(company.gmailRefreshToken);
      const newTokens = await refreshAccessToken(refreshToken);
      const newAccess = newTokens.access_token;

      await prisma.company.update({
        where: { id: input.companyId },
        data: { gmailAccessToken: encryptToken(newAccess) },
      });

      await send(newAccess);
      return { ok: true, provider: "GMAIL", fromAddress };
    } catch (refreshErr) {
      const refreshMsg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
      throw new TenantMailSendError("GMAIL", refreshMsg, refreshErr);
    }
  }
}

/**
 * Sigurno enkodira display ime za RFC 5322 "From" header.
 * Ako sadrži non-ASCII (č, ć, š, …) ili specijalne znakove (`,`, `;`, `<`, `>`),
 * koristi MIME Q-encoded oblik. Inače wrapa u double-quote da Gmail
 * "Tomislav Bobek" prikaže punim imenom umjesto da padne na lokalni dio adrese.
 */
function encodeMailDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const isAscii = /^[\x20-\x7E]*$/.test(trimmed);
  if (!isAscii) {
    return `=?UTF-8?B?${Buffer.from(trimmed).toString("base64")}?=`;
  }
  // Quote string ako sadrži znakove koji bi inače razbili header.
  const needsQuote = /[",;<>()@\\\/]/.test(trimmed);
  return needsQuote ? `"${trimmed.replace(/"/g, '\\"')}"` : trimmed;
}

async function sendViaSmtp(input: TenantSendInput): Promise<TenantSendResult> {
  const cached = await getCompanySmtpTransporter(input.companyId);
  if (!cached) throw new TenantMailNotConfiguredError();

  try {
    const info = await cached.transporter.sendMail({
      from: cached.fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachment
        ? [
            {
              filename: input.attachment.filename,
              content: input.attachment.data,
              contentType: input.attachment.mimeType,
            },
          ]
        : undefined,
    });
    logInfo("tenant_mail_smtp_sent", {
      companyId: input.companyId,
      to: input.to,
      subject: input.subject,
      messageId: info.messageId,
    });
    return {
      ok: true,
      provider: "SMTP",
      messageId: info.messageId ?? undefined,
      fromAddress: cached.fromAddress,
    };
  } catch (err) {
    // Pri grešci uvijek invalidiraj cache — možda je promijenjena lozinka ili host nije dostupan.
    invalidateTransporter(input.companyId);
    const msg = err instanceof Error ? err.message : String(err);
    logWarn("tenant_mail_smtp_failed", { companyId: input.companyId, to: input.to, error: msg });
    throw new TenantMailSendError("SMTP", msg, err);
  }
}
