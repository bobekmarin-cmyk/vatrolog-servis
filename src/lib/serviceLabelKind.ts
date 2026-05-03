import type { ServiceLabelKind } from "@prisma/client";

export const SERVICE_LABEL_KINDS: ServiceLabelKind[] = [
  "PERIODIC",
  "APPARATUS_MASS",
  "CYLINDER_MASS",
];

export function serviceLabelKindLabel(kind: ServiceLabelKind): string {
  switch (kind) {
    case "PERIODIC":
      return "Naljepnica periodičnog pregleda";
    case "APPARATUS_MASS":
      return "Naljepnica mase aparata";
    case "CYLINDER_MASS":
      return "Naljepnica mase bočice";
  }
}

export function serviceLabelKindShortLabel(kind: ServiceLabelKind): string {
  switch (kind) {
    case "PERIODIC":
      return "PP";
    case "APPARATUS_MASS":
      return "Masa aparata";
    case "CYLINDER_MASS":
      return "Masa bočice";
  }
}

/** "Naljepnica periodičnog pregleda (PASTOR)" */
export function formatServiceLabelFullName(
  kind: ServiceLabelKind,
  manufacturerName: string,
): string {
  return `${serviceLabelKindLabel(kind)} (${manufacturerName})`;
}

export function authorizationCodeForKind(
  kind: ServiceLabelKind,
  auth: {
    periodicLabelCode: string | null;
    apparatusMassLabelCode: string | null;
    cylinderMassLabelCode: string | null;
  } | null,
): string | null {
  if (!auth) return null;
  switch (kind) {
    case "PERIODIC":
      return auth.periodicLabelCode ?? null;
    case "APPARATUS_MASS":
      return auth.apparatusMassLabelCode ?? null;
    case "CYLINDER_MASS":
      return auth.cylinderMassLabelCode ?? null;
  }
}
