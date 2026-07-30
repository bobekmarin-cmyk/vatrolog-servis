/**
 * Konstante i tipovi obavijesti — bez dodira s bazom.
 *
 * Odvojeno od `notifications.ts` (koji importa `@/lib/prisma`) da ih smiju
 * koristiti i `"use client"` componente bez povlačenja Prisme u browser bundle.
 */

export const NOTIFICATIONS_HOME_PATH = "/notifications";

export const UPDATE_SECTION_KINDS = ["NEW", "IMPROVED", "FIXED", "IMPORTANT"] as const;
export type UpdateSectionKind = (typeof UPDATE_SECTION_KINDS)[number];

export const UPDATE_SECTION_LABELS: Record<UpdateSectionKind, string> = {
  NEW: "Novo",
  IMPROVED: "Poboljšano",
  FIXED: "Ispravljeno",
  IMPORTANT: "Važno za korisnike",
};

export type UpdateSection = {
  kind: UpdateSectionKind;
  /** Opcionalni naslov sekcije (default je iz `UPDATE_SECTION_LABELS`). */
  title?: string;
  /** Pojedinačne stavke (bullet list). */
  items: string[];
};

export type UpdatePayload = {
  /** Verzija aplikacije, npr. "1.1.0". */
  version: string;
  /** ISO datum (YYYY-MM-DD) objave verzije. */
  releaseDate?: string;
  sections: UpdateSection[];
};

export function isUpdatePayload(value: unknown): value is UpdatePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== "string") return false;
  if (!Array.isArray(v.sections)) return false;
  return v.sections.every((s) => {
    if (!s || typeof s !== "object") return false;
    const sec = s as Record<string, unknown>;
    if (!UPDATE_SECTION_KINDS.includes(sec.kind as UpdateSectionKind)) return false;
    if (!Array.isArray(sec.items)) return false;
    return sec.items.every((it) => typeof it === "string");
  });
}
