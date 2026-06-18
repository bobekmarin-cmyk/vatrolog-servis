/**
 * Raster naljepnica + format internog broja za QR generator.
 *
 * SVE MJERE SU U MILIMETRIMA. PDF se generira u točnom A4 (210×297 mm), a
 * pozicioniranje naljepnica je apsolutno (mm → pt) kako bi se naljepnice
 * poklopile s rezanim arkom „od ruba do ruba”.
 *
 * Točnost ispisa: korisnik MORA ispisati na 100% / „Stvarna veličina”
 * (bez „Prilagodi stranici / Fit to page”), inače pisač skalira raster.
 * Za provjeru postoji kalibracijski list (ravnalom se mjeri referentna linija).
 *
 * Ovaj modul je čist (bez servera/Prisme) pa ga smije koristiti i klijentska forma.
 */

/** 1 mm u PDF točkama (1 inch = 72 pt = 25.4 mm). */
export const MM_TO_PT = 72 / 25.4;

/** Pretvori milimetre u PDF točke. */
export function mm(value: number): number {
  return value * MM_TO_PT;
}

export type LabelSheetPreset = {
  id: string;
  label: string;
  /** Dimenzije stranice u mm (A4 = 210 × 297). */
  page: { width: number; height: number };
  columns: number;
  rows: number;
  labelWidth: number;
  labelHeight: number;
  /** Razmak od gornjeg/lijevog ruba arka do prve naljepnice (mm). */
  marginTop: number;
  marginLeft: number;
  /** Razmaci između naljepnica (mm). */
  columnGap: number;
  rowGap: number;
};

/**
 * Presetovi rastera. Mjere su lako podesive — nakon kalibracije samo se
 * korigiraju vrijednosti ovdje (ili fini pomak offsetX/offsetY iz forme).
 */
export const LABEL_SHEET_PRESETS: LabelSheetPreset[] = [
  {
    id: "70x50_8-15",
    label: "70 × 50,8 mm — 15/A4 (3 × 5)",
    page: { width: 210, height: 297 },
    columns: 3,
    rows: 5,
    labelWidth: 70,
    labelHeight: 50.8,
    // 3 × 70 = 210 → puna širina, od ruba do ruba (bez bočnih margina).
    marginLeft: 0,
    columnGap: 0,
    // (297 − 5 × 50,8) / 2 = 21,5 → vertikalno centrirano.
    marginTop: 21.5,
    rowGap: 0,
  },
];

export function getLabelSheetPreset(id: string | null | undefined): LabelSheetPreset {
  return LABEL_SHEET_PRESETS.find((p) => p.id === id) ?? LABEL_SHEET_PRESETS[0];
}

/** Dostupne težine/zapremine punjenja (kg ili L). */
export const LABEL_WEIGHTS = [1, 2, 3, 4, 6, 9, 10, 12, 20, 50, 100, 250] as const;

export const MAX_LABELS_PER_PDF = 2000;
export const MAX_SEQ = 99999;

/**
 * Format internog broja: SS WWW NNNNN (10 znamenki, bez crtice).
 *   SS    – dvoznamenkasta šifra servisa (Company.serviceCode)
 *   WWW   – troznamenkasta težina punjenja (006, 050, 250)
 *   NNNNN – peteroznamenkasti redni broj aparata pod tom težinom
 * Primjer: serviceCode "01", težina 6, redni 1 → "0100600001".
 */
export function formatLabelCode(serviceCode: string, weight: number, seq: number): string {
  const ss = serviceCode.replace(/\D/g, "").padStart(2, "0").slice(-2);
  const www = String(Math.trunc(weight)).padStart(3, "0").slice(-3);
  const nnnnn = String(seq).padStart(5, "0");
  return `${ss}${www}${nnnnn}`;
}

export type LabelRangeInput = {
  weight: number;
  from: number;
  to: number;
};

export type LabelRangeValidation =
  | { ok: true; count: number }
  | { ok: false; error: string };

export function validateLabelRange(input: LabelRangeInput): LabelRangeValidation {
  const { weight, from, to } = input;
  if (!Number.isFinite(weight) || weight <= 0) {
    return { ok: false, error: "Odaberite težinu punjenja." };
  }
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return { ok: false, error: "Redni brojevi moraju biti cijeli brojevi." };
  }
  if (from < 1 || to < 1) {
    return { ok: false, error: "Redni broj mora biti najmanje 1." };
  }
  if (to > MAX_SEQ) {
    return { ok: false, error: `Najveći redni broj je ${MAX_SEQ}.` };
  }
  if (from > to) {
    return { ok: false, error: "Početni redni broj mora biti manji ili jednak završnom." };
  }
  const count = to - from + 1;
  if (count > MAX_LABELS_PER_PDF) {
    return { ok: false, error: `Najviše ${MAX_LABELS_PER_PDF} naljepnica po PDF-u (traženo ${count}).` };
  }
  return { ok: true, count };
}

/** Broj stranica za zadani broj naljepnica i preset. */
export function pageCount(labelCount: number, preset: LabelSheetPreset): number {
  const perPage = preset.columns * preset.rows;
  return Math.max(1, Math.ceil(labelCount / perPage));
}
