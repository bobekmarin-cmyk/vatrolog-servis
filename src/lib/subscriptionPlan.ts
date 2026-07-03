import { prisma } from "@/lib/prisma";
import type { SubscriptionPlan } from "@prisma/client";

/**
 * Planovi pretplate i njihove mogućnosti.
 *
 *   START    — nalozi, primke/upisnici/otpremnice (PDF, print), šifrarnici,
 *              cjenici, QR naljepnice. Bez slanja mailom, bez mail integracija,
 *              bez korisničkog portala, bez integracija za fakturiranje.
 *   STANDARD — sve mogućnosti programa osim integracija za fakturiranje.
 *   PREMIUM  — sve, uključivo integracije za fakturiranje (e-računi, ...).
 *
 * Plan postavlja platforma (ručno); naplata po planu dolazi kasnije.
 */

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  START: "Start",
  STANDARD: "Standard",
  PREMIUM: "Premium",
};

export const PLAN_ORDER: SubscriptionPlan[] = ["START", "STANDARD", "PREMIUM"];

export type PlanCapability =
  /** Slanje dokumenata/obavijesti mailom + Gmail/SMTP integracije. */
  | "MAIL_SENDING"
  /** Korisnički portal za vlasnike aparata (pozivnice, dijeljenje dokumenata). */
  | "CUSTOMER_PORTAL"
  /** Integracije s vanjskim servisima za fakturiranje (e-računi, ...). */
  | "INVOICING_INTEGRATIONS";

const CAPABILITY_MIN_PLAN: Record<PlanCapability, SubscriptionPlan> = {
  MAIL_SENDING: "STANDARD",
  CUSTOMER_PORTAL: "STANDARD",
  INVOICING_INTEGRATIONS: "PREMIUM",
};

export function planAllows(plan: SubscriptionPlan, capability: PlanCapability): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(CAPABILITY_MIN_PLAN[capability]);
}

export async function getCompanyPlan(companyId: string): Promise<SubscriptionPlan> {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true },
  });
  return row?.plan ?? "PREMIUM";
}

export async function companyPlanAllows(
  companyId: string,
  capability: PlanCapability,
): Promise<boolean> {
  return planAllows(await getCompanyPlan(companyId), capability);
}

/** Poruka za UI/API kad plan ne pokriva mogućnost. */
export function planUpgradeMessage(capability: PlanCapability): string {
  const minPlan = PLAN_LABELS[CAPABILITY_MIN_PLAN[capability]];
  const what: Record<PlanCapability, string> = {
    MAIL_SENDING: "Slanje dokumenata i obavijesti mailom",
    CUSTOMER_PORTAL: "Korisnički portal",
    INVOICING_INTEGRATIONS: "Integracije za fakturiranje",
  };
  return `${what[capability]} dostupno je od plana ${minPlan}. Za nadogradnju kontaktirajte podršku.`;
}
