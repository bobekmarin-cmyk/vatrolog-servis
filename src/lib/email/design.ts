/**
 * Dizajn tokeni za HTML mail predloške.
 *
 * Boje su preuzete iz PDF dokumenata (otpremnica/upisnik) kako bi mailovi
 * dijelili isti vizualni jezik kao i službeni dokumenti.
 *
 * Mail klijenti (Outlook, Gmail) ne učitavaju pouzdano custom fontove pa
 * koristimo system font stack umjesto Roboto-a iz PDF-a (Roboto ostaje kao
 * fallback ako je instaliran lokalno).
 */

export const EMAIL_COLORS = {
  /** Glavni tekst (slate-900) — naslovi i jaki body. */
  text: "#0f172a",
  /** Sekundarni tekst (slate-600) — meta linije, sub-naslovi. */
  textMuted: "#475569",
  /** Tihi tekst (slate-500) — uppercase labele, footer. */
  textSubtle: "#64748b",
  /** Vrlo tihi tekst (slate-400) — copyright, sitne napomene. */
  textFaint: "#94a3b8",
  /** Glavni border tablica i kartica (slate-200). */
  border: "#e2e8f0",
  /** Lakši border (gray-100) — separator redova u tablici. */
  borderLight: "#edf2f7",
  /** Brand crvena (red-600) — akcent crtica, CTA gumb. */
  accent: "#dc2626",
  /** Tamniji brand za hover states (red-700). */
  accentDark: "#b91c1c",
  /** Pozadina kartice. */
  surface: "#ffffff",
  /** Pozadina iza kartice (slate-100). */
  pageBg: "#f1f5f9",
  /** Pozadina callout boxa (red-50). */
  calloutBg: "#fef2f2",
  /** Border callout boxa (red-200). */
  calloutBorder: "#fecaca",
  /** Sekundarna pozadina za info blokove (slate-50). */
  surfaceMuted: "#f8fafc",
} as const;

export const EMAIL_FONTS = {
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
} as const;

export const EMAIL_SIZES = {
  /** Glavni naslov u headeru / sekciji. */
  heading: 22,
  /** Sub-heading (npr. ispod brand titlea). */
  subheading: 14,
  /** Body tekst. */
  body: 14,
  /** Sitni tekst (closing, calloutu sub-tekst). */
  small: 12,
  /** Caption / footer. */
  caption: 11,
} as const;

export const EMAIL_MAX_WIDTH = 600;

/** Javni URL proizvoda — footer i header link u svim mailovima. */
export const VATROLOG_SITE_URL = "https://vatrolog.com";
export const VATROLOG_PRODUCT_NAME = "VatroLog";

/** Dimenzije akcentne crtice (32×2) — istovjetno kao `introAccent` u PDF-u. */
export const EMAIL_ACCENT_BAR = { width: 32, height: 2 } as const;
