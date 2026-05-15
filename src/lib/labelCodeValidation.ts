import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Validacija šifri naljepnica pri spremanju ovlaštenja
 * (`CompanyManufacturerAuthorization`).
 *
 * Pravila:
 *   1. Within-row: tri šifre istog proizvođača (periodicLabelCode,
 *      apparatusMassLabelCode, cylinderMassLabelCode) moraju biti različite ili
 *      prazne (null).
 *   2. Per-kind across company: za jednu vrstu naljepnice (npr. APPARATUS_MASS)
 *      kroz SVA ovlaštenja iste tvrtke vrijedi ili SVE šifre identične, ili SVE
 *      različite. Nije dozvoljena mješavina (npr. Pastor=0001, Klaleda=0001,
 *      Tornado=0002 → ERROR). Prazne (null) šifre se ignoriraju u provjeri.
 *
 * Vraća `ok: true` ako je sve u redu, ili `ok: false` s human-readable
 * porukom razloga koja se može direktno baciti kao `AppValidationError`.
 */

export type LabelCodeKind = "periodicLabelCode" | "apparatusMassLabelCode" | "cylinderMassLabelCode";

export const LABEL_CODE_KINDS: LabelCodeKind[] = [
  "periodicLabelCode",
  "apparatusMassLabelCode",
  "cylinderMassLabelCode",
];

export const LABEL_CODE_LABELS: Record<LabelCodeKind, string> = {
  periodicLabelCode: "PP naljepnica",
  apparatusMassLabelCode: "naljepnica mase aparata",
  cylinderMassLabelCode: "naljepnica mase bočice",
};

export type LabelCodesInput = {
  periodicLabelCode: string | null;
  apparatusMassLabelCode: string | null;
  cylinderMassLabelCode: string | null;
};

export type ValidationOk = { ok: true };
export type ValidationFail = { ok: false; reason: string };
export type ValidationResult = ValidationOk | ValidationFail;

type Tx =
  | PrismaClient
  | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function norm(code: string | null | undefined): string | null {
  if (code == null) return null;
  const trimmed = code.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Provjeri da su tri šifre istog ovlaštenja međusobno različite (ignoriraju se prazne).
 */
export function validateWithinRow(input: LabelCodesInput): ValidationResult {
  const seen = new Map<string, LabelCodeKind>();
  for (const kind of LABEL_CODE_KINDS) {
    const code = norm(input[kind]);
    if (code == null) continue;
    if (seen.has(code)) {
      const otherKind = seen.get(code) as LabelCodeKind;
      return {
        ok: false,
        reason: `Šifra "${code}" je iskorištena za ${LABEL_CODE_LABELS[otherKind]} i za ${LABEL_CODE_LABELS[kind]}. Šifre za različite vrste naljepnica moraju biti različite.`,
      };
    }
    seen.set(code, kind);
  }
  return { ok: true };
}

/**
 * Provjera za jednu vrstu naljepnice kroz sva company-ova ovlaštenja.
 *
 * Pristupa bazi preko `tx` i traži već spremljene šifre za tu kind kod
 * drugih proizvođača iste tvrtke (osim onog koji se trenutno sprema).
 * Vraća fail ako bi se "miješalo".
 */
export async function validatePerKindAcrossCompany(
  tx: Tx,
  params: {
    companyId: string;
    manufacturerId: string;
    kind: LabelCodeKind;
    newCode: string | null;
  },
): Promise<ValidationResult> {
  const newCode = norm(params.newCode);
  if (newCode == null) {
    return { ok: true };
  }

  const existing = await (tx as PrismaClient).companyManufacturerAuthorization.findMany({
    where: {
      companyId: params.companyId,
      manufacturerId: { not: params.manufacturerId },
      NOT: { [params.kind]: null } as unknown as Prisma.CompanyManufacturerAuthorizationWhereInput,
    },
    select: {
      manufacturer: { select: { name: true, displayName: true } },
      periodicLabelCode: true,
      apparatusMassLabelCode: true,
      cylinderMassLabelCode: true,
    },
  });

  if (existing.length === 0) {
    return { ok: true };
  }

  type Row = {
    manufacturer: { name: string; displayName: string | null };
    periodicLabelCode: string | null;
    apparatusMassLabelCode: string | null;
    cylinderMassLabelCode: string | null;
  };

  const matches: string[] = [];
  const differs: string[] = [];
  for (const row of existing as Row[]) {
    const c = norm(row[params.kind]);
    if (c == null) continue;
    const name = row.manufacturer.displayName?.trim() || row.manufacturer.name;
    if (c === newCode) {
      matches.push(`${name}=${c}`);
    } else {
      differs.push(`${name}=${c}`);
    }
  }

  if (matches.length > 0 && differs.length > 0) {
    return {
      ok: false,
      reason:
        `Ne smiješ miješati istu i različitu šifru za ${LABEL_CODE_LABELS[params.kind]}. ` +
        `Nova šifra ${newCode} podudara se s [${matches.join(", ")}], ali postoje i različite [${differs.join(", ")}]. ` +
        `Sve aktivne šifre za ${LABEL_CODE_LABELS[params.kind]} moraju biti ili SVE iste ili SVE različite.`,
    };
  }

  return { ok: true };
}

/**
 * Glavna validacija prije upserta jednog ovlaštenja.
 * Kombinira within-row i per-kind across-company provjere.
 */
export async function validateLabelCodes(
  tx: Tx,
  params: {
    companyId: string;
    manufacturerId: string;
    codes: LabelCodesInput;
  },
): Promise<ValidationResult> {
  const within = validateWithinRow(params.codes);
  if (!within.ok) return within;

  for (const kind of LABEL_CODE_KINDS) {
    const r = await validatePerKindAcrossCompany(tx, {
      companyId: params.companyId,
      manufacturerId: params.manufacturerId,
      kind,
      newCode: params.codes[kind],
    });
    if (!r.ok) return r;
  }

  return { ok: true };
}
