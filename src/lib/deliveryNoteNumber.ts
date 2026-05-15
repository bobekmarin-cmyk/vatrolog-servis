import { zagrebCalendarYear, zagrebTwoDigitYear } from "./deliveryNoteZagreb";

export { zagrebCalendarYear, zagrebTwoDigitYear, DELIVERY_NOTE_TZ } from "./deliveryNoteZagreb";

export type CompanyForDeliveryNotePrefix = {
  serviceCode: string;
  deliveryNoteNumberPrefix: string | null;
};

/** Dva znaka prefiksa za broj otpremnice. */
export function resolveDeliveryNotePrefix(company: CompanyForDeliveryNotePrefix): string {
  const manual = company.deliveryNoteNumberPrefix?.trim();
  if (manual && manual.length > 0) {
    const cleaned = manual.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length >= 2) return cleaned.slice(0, 2);
    return (cleaned + "0").slice(0, 2);
  }
  const digits = company.serviceCode.replace(/\D/g, "");
  if (digits.length >= 2) return digits.slice(-2);
  if (digits.length === 1) return `0${digits}`;
  const a = company.serviceCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (a.length >= 2) return a.slice(0, 2);
  return "00";
}

export function buildDeliveryNoteFullNumber(
  company: CompanyForDeliveryNotePrefix,
  issuedAt: Date,
  seq: number,
): { number: string; prefix: string; yy: string; year: number } {
  const prefix = resolveDeliveryNotePrefix(company);
  const yy = zagrebTwoDigitYear(issuedAt);
  const year = zagrebCalendarYear(issuedAt);
  const number = `${prefix}-${yy}${String(seq).padStart(4, "0")}`;
  return { number, prefix, yy, year };
}
