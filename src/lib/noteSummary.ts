/**
 * Skraćivanje napomena za prikaz u popisima i tablicama.
 *
 * Napomene korisnici unose slobodno, često s prelomima redaka i višestrukim
 * razmacima, pa ih prije prikaza treba svesti na jedan red i ograničiti duljinu.
 */

const MAX_LENGTH = 60;

/** Sažme napomenu na jedan red, najviše 60 znakova. */
export function summarizeNote(note: string | null | undefined): string {
  if (note == null) return "";
  const clean = note.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_LENGTH) return clean;
  return `${clean.slice(0, MAX_LENGTH - 1)}…`;
}
