import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Validacija šifri naljepnica pri spremanju ovlaštenja
 * (`CompanyManufacturerAuthorization`) ili zajedničkih šifri u SHARED modu.
 *
 * Pravila ovise o `Company.labelCodeStrategy`:
 *   - SHARED: jedan set od 3 šifre primjenjuje se na sve proizvođače.
 *     Per-manufacturer šifre se NE smiju mijenjati. Validira se SAMO da su
 *     tri šifre unutar tog jednog seta međusobno različite (within-row).
 *   - PER_MANUFACTURER: svaki proizvođač ima vlastiti set. Šifre za istu
 *     vrstu naljepnice (npr. APPARATUS_MASS) kroz sve proizvođače moraju
 *     biti RAZLIČITE — sustav ne dozvoljava dvjema proizvođačima istu šifru
 *     unutar iste vrste (jer onda treba koristiti SHARED mod). Within-row
 *     validacija isto vrijedi (3 šifre istog proizvođača međusobno različite).
 *
 * Prazne (null/trimmed-empty) šifre se ignoriraju u svim provjerama.
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
 * Tri šifre u istom setu (jednog proizvođača ili SHARED set) moraju biti
 * međusobno različite (ignoriraju se prazne).
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
 * U PER_MANUFACTURER modu — za zadanu vrstu naljepnice, nova šifra ne smije
 * koincidirati ni s jednom postojećom šifrom istog tipa kod drugog proizvođača.
 */
export async function validatePerManufacturerUnique(
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

  type Row = {
    manufacturer: { name: string; displayName: string | null };
    periodicLabelCode: string | null;
    apparatusMassLabelCode: string | null;
    cylinderMassLabelCode: string | null;
  };

  const collisions: string[] = [];
  for (const row of existing as Row[]) {
    const c = norm(row[params.kind]);
    if (c == null) continue;
    if (c === newCode) {
      const name = row.manufacturer.displayName?.trim() || row.manufacturer.name;
      collisions.push(name);
    }
  }

  if (collisions.length > 0) {
    return {
      ok: false,
      reason:
        `Šifra "${newCode}" za ${LABEL_CODE_LABELS[params.kind]} već postoji kod proizvođača: ${collisions.join(", ")}. ` +
        `U različitom načinu šifriranja sve šifre iste vrste moraju biti jedinstvene po proizvođaču. ` +
        `Ako želiš da svi proizvođači imaju istu šifru, prebaci se na zajednički način šifriranja.`,
    };
  }

  return { ok: true };
}

/**
 * PER_MANUFACTURER mod: validacija prije upserta jednog proizvođača —
 * within-row + per-kind uniqueness kroz druge proizvođače.
 */
export async function validateLabelCodesPerManufacturer(
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
    const r = await validatePerManufacturerUnique(tx, {
      companyId: params.companyId,
      manufacturerId: params.manufacturerId,
      kind,
      newCode: params.codes[kind],
    });
    if (!r.ok) return r;
  }

  return { ok: true };
}

/**
 * SHARED mod: validacija seta od 3 šifre koji se primjenjuje na sve
 * proizvođače — samo within-row pravilo.
 */
export function validateSharedLabelCodes(codes: LabelCodesInput): ValidationResult {
  return validateWithinRow(codes);
}
