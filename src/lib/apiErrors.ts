/**
 * Mapira nepoznate greške na sigurne poruke za klijenta (bez curenja internih detalja).
 */
export function apiErrorMessage(e: unknown, fallback = "Došlo je do greške."): string {
  if (e instanceof Error) {
    const m = e.message;
    if (m.includes("Unique constraint") || m.includes("unique constraint")) {
      return "Zapis već postoji (jedinstveno ograničenje).";
    }
    if (m === "CUSTOMER_NOT_FOUND") return "Kupac nije pronađen.";
    if (m === "DEPARTMENT_REQUIRED") return "Odaberi odjeljenje.";
    if (m === "DEPARTMENT_NOT_FOUND") return "Odjeljenje nije pronađeno.";
    if (m === "RECEIPT_NOT_FOUND") return "Primka nije pronađena.";
  }
  return fallback;
}
