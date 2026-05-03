/**
 * Konvencije za usernamee tenant računa.
 *
 * Pattern: `{serviceCode}-{slug}{suffix}`
 *
 *   Admin              → `{serviceCode}-{slug}`        npr. `01-vatrobr`
 *   Stacionarni 1      → `{serviceCode}-{slug}S`        npr. `01-vatrobrS`
 *   Stacionarni N≥2    → `{serviceCode}-{slug}S{N}`     npr. `01-vatrobrS2`
 *   Vozilo N (N≥1)     → `{serviceCode}-{slug}V{N}`     npr. `01-vatrobrV1`
 *
 * `slug` je izveden iz `Company.shortName` (lowercase, samo a-z0-9, prvih 7 chars),
 * ali je editabilan na platform onboardingu i u "Uredi tvrtku".
 */

export type LocationKind = "STATIONARY" | "VEHICLE";

export const USERNAME_SLUG_REGEX = /^[a-z0-9]{2,15}$/;
export const SERVICE_CODE_REGEX = /^\d{2}$/;

export function normalizeServiceCode(input: string): string {
  return input.trim();
}

/**
 * Izvodi default slug iz shortName-a / name-a tvrtke:
 * lowercase, samo a-z0-9, prvih 7 chars. Vraća null ako nije moguće (svi znakovi non-alfa).
 */
export function deriveUsernameSlug(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleaned) return null;
  return cleaned.slice(0, 7);
}

export function buildAdminUsername(serviceCode: string, slug: string): string {
  return `${normalizeServiceCode(serviceCode)}-${slug}`;
}

/**
 * Sufiks po tipu i ordinal-u:
 *   STATIONARY ord=1 → "S"
 *   STATIONARY ord=N → "S{N}" (N≥2)
 *   VEHICLE    ord=N → "V{N}" (N≥1)
 */
export function buildLocationSuffix(kind: LocationKind, ordinal: number): string {
  if (!Number.isFinite(ordinal) || ordinal < 1) {
    throw new Error(`Invalid ordinal: ${ordinal}`);
  }
  if (kind === "STATIONARY") {
    return ordinal === 1 ? "S" : `S${ordinal}`;
  }
  return `V${ordinal}`;
}

export function buildLocationUsername(
  serviceCode: string,
  slug: string,
  kind: LocationKind,
  ordinal: number,
): string {
  return `${normalizeServiceCode(serviceCode)}-${slug}${buildLocationSuffix(kind, ordinal)}`;
}

/**
 * Default labela koja se nudi vendoru pri kreiranju nove lokacije
 * (može se prepisati u "Prepravi labele" sekciji ili kasnijim rename-om).
 */
export function buildLocationLabel(kind: LocationKind, ordinal: number): string {
  if (kind === "STATIONARY") {
    return ordinal === 1 ? "Stacionarni servis" : `Stacionarni servis ${ordinal}`;
  }
  return `Servisno vozilo ${ordinal}`;
}

export function isAdminUsername(username: string, serviceCode: string, slug: string): boolean {
  return username === buildAdminUsername(serviceCode, slug);
}

/**
 * Sigurnosna provjera username slug-a (a-z0-9, 2-15).
 */
export function isValidUsernameSlug(slug: string): boolean {
  return USERNAME_SLUG_REGEX.test(slug);
}

/**
 * Validira ručno upisan username (servicecode + slug + opcionalni suffix S/V/SN/VN).
 * Ne provjerava jedinstvenost — to radi DB unique constraint.
 */
export function isValidTenantUsername(username: string): boolean {
  return /^\d{2}-[a-z0-9]{2,30}$/.test(username);
}
