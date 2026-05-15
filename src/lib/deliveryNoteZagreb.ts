/** ISTA zona kao u planu — broj godine u numeraciji otpremnice. */
export const DELIVERY_NOTE_TZ = "Europe/Zagreb";

export function zagrebCalendarYear(d: Date): number {
  const y = new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_NOTE_TZ,
    year: "numeric",
  }).format(d);
  return parseInt(y, 10);
}

/** Dvoznamenkasta godina (npr. 2026 → "26"). */
export function zagrebTwoDigitYear(d: Date): string {
  return String(zagrebCalendarYear(d) % 100).padStart(2, "0");
}
