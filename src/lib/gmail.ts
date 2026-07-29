import crypto from "crypto";
import { getPublicAppUrl } from "@/lib/appVersion";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? "";

const ALGORITHM = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(): Buffer {
  // Dedicated data-encryption key: u produkciji obavezan, u dev-u dozvoljeno
  // fallback-ati na AUTH_SECRET kako lokalno pokretanje ne bi puknulo.
  // (envChecks pri bootu već upozorava ako ENCRYPTION_KEY fali.)
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
      throw new Error(
        "ENCRYPTION_KEY je obavezan u produkciji (min. 32 znaka, različit od AUTH_SECRET).",
      );
    }
    if (ENCRYPTION_KEY === AUTH_SECRET) {
      throw new Error("ENCRYPTION_KEY ne smije biti jednak AUTH_SECRET-u u produkciji.");
    }
    return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
  }
  return crypto.createHash("sha256").update(ENCRYPTION_KEY || AUTH_SECRET).digest();
}

export function encryptToken(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  const key = deriveKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final("utf8");
}

// --- OAuth helpers ---

export function getRedirectUri() {
  return `${getPublicAppUrl()}/api/gmail/callback`;
}

export function buildConsentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function fetchGmailEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch user info");
  const data = await res.json();
  return data.email as string;
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

// --- Gmail Send ---

function buildMimeMessage(from: string, to: string, subject: string, htmlBody: string): string {
  const boundary = `boundary_${crypto.randomUUID()}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(htmlBody).toString("base64"),
    "",
    `--${boundary}--`,
  ];
  return lines.join("\r\n");
}

export async function sendGmail(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<void> {
  const raw = buildMimeMessage(from, to, subject, htmlBody);
  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed: ${res.status} ${text}`);
  }
}

function buildMimeMessageWithAttachment(
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  attachment: { filename: string; mimeType: string; data: Buffer },
): string {
  const mixedBoundary = `mixed_${crypto.randomUUID()}`;
  const altBoundary = `alt_${crypto.randomUUID()}`;
  const b64Content = attachment.data.toString("base64");

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(htmlBody).toString("base64"),
    "",
    `--${altBoundary}--`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    "",
    b64Content,
    "",
    `--${mixedBoundary}--`,
  ];
  return lines.join("\r\n");
}

export async function sendGmailWithAttachment(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  attachment: { filename: string; mimeType: string; data: Buffer },
): Promise<void> {
  const raw = buildMimeMessageWithAttachment(from, to, subject, htmlBody, attachment);
  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed: ${res.status} ${text}`);
  }
}

// --- Email template ---

export function buildNotificationHtml(
  companyName: string,
  customerName: string,
  monthLabel: string,
  itemCount: number,
): string {
  return `
<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 3px solid #dc2626; padding-bottom: 16px; margin-bottom: 24px;">
    <h2 style="margin: 0; color: #dc2626;">${companyName}</h2>
    <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Obavijest o isteku servisa vatrogasnih aparata</p>
  </div>

  <p>Poštovani,</p>

  <p>obavještavamo Vas da Vam u mjesecu <strong>${monthLabel}</strong> ističe rok servisa za
  <strong>${itemCount}</strong> vatrogasni${itemCount === 1 ? "" : itemCount < 5 ? "h" : "h"} aparat${itemCount === 1 ? "" : "a"}.</p>

  <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
    <strong>Broj aparata kojima ističe servis: ${itemCount}</strong>
  </div>

  <p>Molimo Vas da nas kontaktirate radi dogovora oko servisiranja Vaših vatrogasnih aparata kako biste ostali u skladu s propisima.</p>

  <p style="margin-top: 32px;">S poštovanjem,<br><strong>${companyName}</strong></p>

  <hr style="border: none; border-top: 1px solid #eee; margin-top: 32px;">
  <p style="font-size: 11px; color: #999; line-height: 1.5;">
    Poslano iz programa <strong>VatroLog</strong> ·
    <a href="https://vatrolog.com" style="color:#dc2626;text-decoration:none;">vatrolog.com</a><br>
    Softver za upravljanje servisom vatrogasnih aparata<br>
    &copy; ${new Date().getFullYear()} VatroLog. Automatski generirano.
  </p>
</body>
</html>`;
}
