/**
 * HTML "komponente" za mail predloške — male funkcije koje vraćaju
 * potpuno inline-styled HTML stringove. Inline CSS je nužan jer Outlook,
 * Yahoo i razni mobilni klijenti ignoriraju `<style>` tagove.
 *
 * Sve funkcije primaju **siguran** tekst i ne escapeaju ga interno; pozivatelj
 * je odgovoran za pripremu (npr. `escapeHtml` iz `./layout`). Razlog: neki
 * pozivatelji žele inline `<strong>`, neki žele samo plain text — single
 * pravilo "uvijek escapaj" bi razbilo bold u tijelu.
 */

import { EMAIL_ACCENT_BAR, EMAIL_COLORS, EMAIL_FONTS, EMAIL_SIZES } from "./design";

export type EmailBranding = {
  fromName: string;
  fromEmail: string;
  signatureHtml: string | null;
  logoUrl: string | null;
  brandColor: string;
};

/** Dvobojni "VatroLog" naslov (Vatro tamno, Log brand) — istovjetno kao u PDF headeru. */
export function emailBrandTitle(name: string, brandColor: string): string {
  const trimmed = name.trim();
  if (trimmed.toLowerCase() === "vatrolog") {
    return (
      `<div style="font-family:${EMAIL_FONTS.body};font-weight:800;font-size:22px;letter-spacing:-0.01em;line-height:1;">` +
      `<span style="color:${EMAIL_COLORS.text};font-weight:800;">Vatro</span>` +
      `<span style="color:${brandColor};font-weight:800;">Log</span>` +
      `</div>`
    );
  }
  return (
    `<div style="font-family:${EMAIL_FONTS.body};font-weight:800;font-size:22px;letter-spacing:-0.01em;color:${brandColor};">` +
    `${escapeHtmlLite(trimmed)}` +
    `</div>`
  );
}

/** Jedan brand red (slika ili tipografski naslov) + debela crvena crta ispod — bez duplog logotipa. */
export function emailHeader(branding: EmailBranding, documentLabel?: string): string {
  const logoBlock = branding.logoUrl
    ? `<img src="${escapeHtmlLite(branding.logoUrl)}" alt="${escapeHtmlLite(branding.fromName)}" height="28" style="height:28px;display:block;border:0;outline:none;" />`
    : emailBrandTitle(branding.fromName, branding.brandColor);

  const labelBlock = documentLabel
    ? `<div style="font-family:${EMAIL_FONTS.body};font-size:${EMAIL_SIZES.caption}px;color:${EMAIL_COLORS.textSubtle};text-transform:uppercase;letter-spacing:0.6px;font-weight:600;margin-bottom:6px;">${escapeHtmlLite(documentLabel)}</div>`
    : "";

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-bottom:4px solid ${branding.brandColor};padding-bottom:14px;margin-bottom:18px;">` +
    `<tr>` +
    `<td valign="top" style="padding:0;">${labelBlock}${logoBlock}</td>` +
    `</tr>` +
    `</table>`
  );
}

/** Crvena akcent crtica 32×2 — istovjetno kao `introAccent` u PDF-u. */
export function emailAccentBar(brandColor: string = EMAIL_COLORS.accent): string {
  return `<div style="width:${EMAIL_ACCENT_BAR.width}px;height:${EMAIL_ACCENT_BAR.height}px;background:${brandColor};margin:0 0 14px 0;font-size:0;line-height:0;">&nbsp;</div>`;
}

/** Naslov sekcije (22px bold, slate-900). */
export function emailHeading(text: string): string {
  return `<h1 style="font-family:${EMAIL_FONTS.body};font-size:${EMAIL_SIZES.heading}px;font-weight:700;color:${EMAIL_COLORS.text};margin:0 0 8px 0;line-height:1.25;">${text}</h1>`;
}

/** Body paragraf (14px, slate-700-ish). */
export function emailParagraph(html: string): string {
  return `<p style="font-family:${EMAIL_FONTS.body};font-size:${EMAIL_SIZES.body}px;line-height:1.6;color:${EMAIL_COLORS.textMuted};margin:0 0 14px 0;">${html}</p>`;
}

/** Tihi pomoćni tekst ispod CTA-a (12px, slate-500). */
export function emailMutedParagraph(html: string): string {
  return `<p style="font-family:${EMAIL_FONTS.body};font-size:${EMAIL_SIZES.small}px;line-height:1.55;color:${EMAIL_COLORS.textSubtle};margin:0 0 12px 0;">${html}</p>`;
}

/** Callout: lijevi crveni border (3px) + svjetla crvena pozadina. */
export function emailCallout(html: string, brandColor: string = EMAIL_COLORS.accent): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:18px 0;">` +
    `<tr><td style="background:${EMAIL_COLORS.calloutBg};border-left:3px solid ${brandColor};padding:14px 16px;font-family:${EMAIL_FONTS.body};font-size:${EMAIL_SIZES.body}px;line-height:1.55;color:${EMAIL_COLORS.text};font-weight:600;">${html}</td></tr>` +
    `</table>`
  );
}

/**
 * CTA gumb — pouzdano bijeli tekst na crvenoj pozadini u Gmailu, Outlooku i Apple Mailu.
 *
 * Gmail Web ima jaki user-agent stylesheet koji `<a>` linkove unutar mail body-a
 * forsira na plavu boju i underline, ignoriraj inline `color:#fff !important`.
 * Trik: tekst je u `<span>` unutar `<a>` — Gmail-ov override gađa `<a>`, a `<span>`
 * uvijek dobije naš style. Bez tankog crvenog border-a (slabi vizualni kontrast).
 */
export function emailButton(input: { href: string; label: string; brandColor?: string }): string {
  const raw = (input.brandColor ?? EMAIL_COLORS.accent).trim();
  const useDefaultRed = !input.brandColor || raw.toLowerCase() === EMAIL_COLORS.accent.toLowerCase();
  const bg = useDefaultRed ? EMAIL_COLORS.accentDark : raw;
  const bgAttr = bg.replace("#", "").toUpperCase();
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 8px 0;border-collapse:separate;">` +
    `<tr><td align="center" bgcolor="#${bgAttr}" style="border-radius:8px;background-color:${bg};mso-padding-alt:0;">` +
    `<a class="vbtn" href="${escapeHtmlLite(input.href)}" target="_blank" rel="noopener" ` +
    `style="display:inline-block;background-color:${bg};border-radius:8px;` +
    `padding:14px 28px;text-decoration:none;border:0;line-height:1;color:#ffffff;">` +
    `<span style="font-family:${EMAIL_FONTS.body};font-size:16px;font-weight:700;` +
    `color:#ffffff;text-decoration:none;letter-spacing:0.02em;line-height:1;display:inline-block;">` +
    `${escapeHtmlLite(input.label)}</span>` +
    `</a></td></tr></table>`
  );
}

/** Tanka separator linija (1px, slate-200). */
export function emailDivider(): string {
  return `<div style="height:1px;line-height:1px;background:${EMAIL_COLORS.border};margin:18px 0;font-size:0;">&nbsp;</div>`;
}

/** Sekcija "key/value" tablica (oib, kontakt, tvrtka...). */
export function emailKeyValueRows(rows: Array<{ label: string; value: string; mono?: boolean }>): string {
  const tr = rows
    .map(
      (r) =>
        `<tr>` +
        `<td style="padding:6px 16px 6px 0;font-family:${EMAIL_FONTS.body};font-size:${EMAIL_SIZES.small}px;color:${EMAIL_COLORS.textSubtle};text-transform:uppercase;letter-spacing:0.4px;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtmlLite(r.label)}</td>` +
        `<td style="padding:6px 0;font-family:${r.mono ? EMAIL_FONTS.mono : EMAIL_FONTS.body};font-size:${EMAIL_SIZES.body}px;color:${EMAIL_COLORS.text};font-weight:${r.mono ? 700 : 500};">${r.value}</td>` +
        `</tr>`,
    )
    .join("");
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 18px 0;">` +
    `${tr}` +
    `</table>`
  );
}

/** "Code/key" naglašeni blok (npr. service code, username) — mono font + suptilna pozadina. */
export function emailCodeBlock(code: string, brandColor: string = EMAIL_COLORS.accent): string {
  return (
    `<div style="background:${EMAIL_COLORS.surfaceMuted};border:1px solid ${EMAIL_COLORS.border};border-radius:6px;padding:12px 16px;margin:8px 0 14px 0;">` +
    `<div style="font-family:${EMAIL_FONTS.mono};font-size:18px;font-weight:700;color:${brandColor};letter-spacing:0.5px;">${escapeHtmlLite(code)}</div>` +
    `</div>`
  );
}

/** Footer: tanka crta + `signatureHtml` ako postoji + auto-tekst + copyright. */
export function emailFooter(branding: EmailBranding, footerNote: string | null): string {
  const sig = branding.signatureHtml
    ? `<div style="font-family:${EMAIL_FONTS.body};font-size:${EMAIL_SIZES.small}px;color:${EMAIL_COLORS.textMuted};margin:0 0 12px 0;">${branding.signatureHtml}</div>`
    : "";
  const note = footerNote
    ? `<div style="font-family:${EMAIL_FONTS.body};font-size:${EMAIL_SIZES.small}px;color:${EMAIL_COLORS.textSubtle};margin:0 0 8px 0;line-height:1.5;">${escapeHtmlLite(footerNote)}</div>`
    : "";
  const year = new Date().getFullYear();
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid ${EMAIL_COLORS.border};margin-top:24px;padding-top:16px;">` +
    `<tr><td style="padding:0;">` +
    `${sig}` +
    `${note}` +
    `<div style="font-family:${EMAIL_FONTS.body};font-size:${EMAIL_SIZES.caption}px;color:${EMAIL_COLORS.textFaint};line-height:1.5;">` +
    `&copy; ${year} ${escapeHtmlLite(branding.fromName)}. Ova poruka je automatski generirana.` +
    `</div>` +
    `</td></tr></table>`
  );
}

/** Minimalan HTML escape (interni; pozivatelji koji žele bold koriste raw). */
function escapeHtmlLite(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
