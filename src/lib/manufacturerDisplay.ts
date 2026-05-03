/**
 * Vrati skraćeni naziv proizvođača za prikaz u svim user-facing dokumentima
 * (PDF-ovi, otpremnica, upisnik, servisne kartice, customer portal, …).
 *
 * Logika:
 *  - Ako `displayName` postoji i nije prazan, koristi njega (npr. „KLALEDA").
 *  - Inače fallback na puni `name` (npr. „Klaleda d.o.o.").
 *
 * Platform admin sučelja namjerno koriste puni `name` jer je to legalni entitet.
 */
export function displayManufacturer(
  m: { name: string; displayName?: string | null } | null | undefined,
): string {
  if (!m) return "—";
  const dn = m.displayName?.trim();
  if (dn && dn.length > 0) return dn;
  return m.name;
}
