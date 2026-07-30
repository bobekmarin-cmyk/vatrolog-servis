/**
 * Formatiranje datuma i vremena za prikaz.
 *
 * Poslužitelj u produkciji radi u UTC-u, pa bi `toLocaleString()` bez
 * eksplicitne zone ispisivao UTC — korisniku u Hrvatskoj to izgleda kao da
 * vrijeme kasni dva sata (ljeti). Zato sve formatiranje ide kroz `Europe/Zagreb`,
 * neovisno o tome gdje se kod izvršava.
 */
export const APP_TIME_ZONE = "Europe/Zagreb";

const dateParts = new Intl.DateTimeFormat("hr-HR", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeParts = new Intl.DateTimeFormat("hr-HR", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const timeParts = new Intl.DateTimeFormat("hr-HR", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** "30.07.2026." */
export function formatDateDdMmYyyy(d?: Date | null): string {
  if (!d) return "-";
  const p = dateParts.formatToParts(d);
  return `${part(p, "day")}.${part(p, "month")}.${part(p, "year")}.`;
}

/** "30.07" */
export function formatDateDdMm(d?: Date | null): string {
  if (!d) return "-";
  const p = dateParts.formatToParts(d);
  return `${part(p, "day")}.${part(p, "month")}`;
}

/** "30.07.2026. 12:17" */
export function formatDateTimeHr(d?: Date | null): string {
  if (!d) return "-";
  const p = dateTimeParts.formatToParts(d);
  return `${part(p, "day")}.${part(p, "month")}.${part(p, "year")}. ${part(p, "hour")}:${part(p, "minute")}`;
}

/** "12:17" */
export function formatTimeHr(d?: Date | null): string {
  if (!d) return "-";
  const p = timeParts.formatToParts(d);
  return `${part(p, "hour")}:${part(p, "minute")}`;
}
