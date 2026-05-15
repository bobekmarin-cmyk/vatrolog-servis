import { customerDisplayName } from "@/lib/customerDisplay";

/** Sufiks u imenu datoteke (bez .pdf), npr. primka, upisnik, otpremnica. */
export type WorkOrderDocSlug = "primka" | "upisnik" | "otpremnica";

/**
 * Siguran segment imena datoteke iz prikazanog imena kupca (ASCII, velika slova).
 */
export function slugifyCustomerFilenamePart(
  customer: { shortName?: string | null; name: string },
  maxLen = 48,
): string {
  const display = customerDisplayName(customer).trim() || customer.name.trim();
  const ascii = display
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
  const cut = ascii.slice(0, maxLen).replace(/_+$/g, "");
  return cut.length > 0 ? cut : "KUPAC";
}

/**
 * Jedan segment prefiksa (šifra servisa ili programski slug) — slova/brojevi, velika slova.
 */
function slugifyProgramSegment(raw: string, maxLen: number): string {
  const s = raw
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()
    .slice(0, maxLen);
  return s.length > 0 ? s : "X";
}

/**
 * Prefiks programa / servisa za imena dokumenata: `{šifra_servisa}_{usernameSlug}`.
 * Primjer: šifra `02`, slug `fosslin` → `02_FOSSLIN` (kao u korisničkim računima `02-fosslin`).
 */
export function buildTenantProgramFilePrefix(company: { serviceCode: string; usernameSlug: string }): string {
  const code = slugifyProgramSegment(company.serviceCode, 16);
  const slug = slugifyProgramSegment(company.usernameSlug, 24);
  return `${code}_${slug}`;
}

export type WorkOrderPdfNames = { fileBase: string; fileName: string; docId: string };

/**
 * Baza imena: `{program}_{docSlug}_{broj_naloga}_{KUPAC}` npr. `02_FOSSLIN_primka_26-05-001_VATROBRAN`.
 */
export function buildWorkOrderPdfNames(
  company: { serviceCode: string; usernameSlug: string },
  order: {
    orderNumber: string;
    customer: { shortName?: string | null; name: string };
  },
  docSlug: WorkOrderDocSlug,
): WorkOrderPdfNames {
  const orderSafe = order.orderNumber.replaceAll("/", "-");
  const program = buildTenantProgramFilePrefix(company);
  const custSlug = slugifyCustomerFilenamePart(order.customer);
  const fileBase = `${program}_${docSlug}_${orderSafe}_${custSlug}`;
  return {
    fileBase,
    fileName: `${fileBase}.pdf`,
    docId: fileBase.replace(/_/g, "-"),
  };
}
