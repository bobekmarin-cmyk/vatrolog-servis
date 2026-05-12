/**
 * Glavni renderer HTML maila — sklapa kompletni email "shell" iz strukturiranih
 * polja (subject, greeting, body, callout, closing, footer). Dijeljeni za
 * vendor (`systemMail.ts`) i tenant (`emailTemplates.ts`) tokove kako bi
 * dizajn bio vizualno usklađen i jedan ažurira sve.
 *
 * API namjerno prihvaća već renderani HTML body iznad polja (raw section)
 * radi pojedinih predložaka koji trebaju gumb / tablicu / listu, ali za
 * standardne 6-poljne predloške dovoljno je proslijediti `fields`.
 */

import { EMAIL_COLORS, EMAIL_FONTS, EMAIL_MAX_WIDTH, EMAIL_SIZES } from "./design";
import {
  emailAccentBar,
  emailCallout,
  emailFooter,
  emailHeader,
  emailHeading,
  emailParagraph,
  type EmailBranding,
} from "./components";

export type RenderedEmail = { subject: string; html: string; text: string };

export type RenderEmailFields = {
  /** Linija pozdrava ("Pozdrav Marin,"). */
  greeting?: string | null;
  /** Glavni tekst (može sadržavati `<strong>`, `<br>` — pripremljen od pozivatelja). */
  bodyText?: string | null;
  /** Naglašena poruka u callout boxu (bold, lijevi crveni border). */
  calloutText?: string | null;
  /** Zaključni tekst (npr. "Molimo nas kontaktirajte..."). */
  closingText?: string | null;
  /** Sitni footer note ispod separatora (12px). */
  footerNote?: string | null;
};

export type RenderEmailInput = {
  /** Subject reda (koristi se i kao `<title>` te kao H1). */
  subject: string;
  /** Preheader (skriveni preview u inboxu). Opcionalan. */
  preheader?: string;
  /** Strukturirana polja — ako su prazna, sekcije se preskaču. */
  fields: RenderEmailFields;
  /** Branding — boje, logo, signature, naziv pošiljatelja. */
  branding: EmailBranding;
  /** Opcionalna labela u headeru (npr. "Servis vatrogasnih aparata"). */
  documentLabel?: string;
  /** HTML koji se renderira ispod `bodyText`-a a iznad `calloutText`-a (gumb, tablica, lista). */
  extraHtml?: string;
  /** Plain text verzija (fallback za klijente bez HTML-a). Ako se ne pošalje, builda se iz polja. */
  text?: string;
};

/**
 * Sklopi kompletan HTML mail iz strukturiranih polja + branding.
 * Vraća `{ subject, html, text }` istovjetno kao postojeći helperi.
 */
export function renderEmailShell(input: RenderEmailInput): RenderedEmail {
  const { subject, preheader, fields, branding, documentLabel, extraHtml } = input;

  const greetingHtml = fields.greeting?.trim()
    ? emailParagraph(`<strong style="color:${EMAIL_COLORS.text};font-weight:600;">${nl2br(fields.greeting)}</strong>`)
    : "";
  const bodyHtml = fields.bodyText?.trim() ? emailParagraph(nl2br(fields.bodyText)) : "";
  const calloutHtml = fields.calloutText?.trim() ? emailCallout(nl2br(fields.calloutText), branding.brandColor) : "";
  const closingHtml = fields.closingText?.trim() ? emailParagraph(nl2br(fields.closingText)) : "";

  const innerContent = [greetingHtml, bodyHtml, extraHtml ?? "", calloutHtml, closingHtml].filter(Boolean).join("");

  const preheaderHtml = preheader
    ? `<div style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : "";

  const html =
    `<!DOCTYPE html>` +
    `<html lang="hr"><head>` +
    `<meta charset="UTF-8" />` +
    `<meta name="viewport" content="width=device-width,initial-scale=1.0" />` +
    `<meta name="x-apple-disable-message-reformatting" />` +
    `<title>${escapeHtml(subject)}</title>` +
    `</head>` +
    `<body style="margin:0;padding:0;background:${EMAIL_COLORS.pageBg};font-family:${EMAIL_FONTS.body};color:${EMAIL_COLORS.text};">` +
    preheaderHtml +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_COLORS.pageBg};">` +
    `<tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="${EMAIL_MAX_WIDTH}" cellpadding="0" cellspacing="0" border="0" ` +
    `style="max-width:${EMAIL_MAX_WIDTH}px;width:100%;background:${EMAIL_COLORS.surface};border:1px solid ${EMAIL_COLORS.border};border-radius:8px;">` +
    `<tr><td style="padding:28px 32px 24px 32px;">` +
    emailHeader(branding, documentLabel) +
    emailAccentBar(branding.brandColor) +
    emailHeading(escapeHtml(subject)) +
    innerContent +
    emailFooter(branding, fields.footerNote ?? null) +
    `</td></tr></table>` +
    `</td></tr></table>` +
    `</body></html>`;

  const text =
    input.text ??
    [
      fields.greeting,
      fields.bodyText,
      fields.calloutText,
      fields.closingText,
      fields.footerNote ? `\n--\n${fields.footerNote}` : "",
    ]
      .filter((s): s is string => Boolean(s?.trim()))
      .join("\n\n");

  return { subject, html, text };
}

/** Pretvori novi-redak u `<br/>` zadržavajući postojeći inline HTML. */
function nl2br(value: string): string {
  return value.replace(/\r?\n/g, "<br/>");
}

/** Standardni HTML escape — koristi ga vendor renderer pri zamjeni varijabli. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
