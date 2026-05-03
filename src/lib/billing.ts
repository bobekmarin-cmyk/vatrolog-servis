/**
 * SaaS naplata: Stripe (ako je konfiguriran) ili ručni / predračun model.
 *
 * Stripe env varijable (sve opcionalne; ako ikoja nedostaje, fallback na ručni model):
 *  - STRIPE_SECRET_KEY
 *  - STRIPE_WEBHOOK_SECRET
 *  - STRIPE_PRICE_STARTER  (npr. price_1AbCdE... za mjesečni Starter plan)
 *  - STRIPE_PRICE_PRO
 *
 * Plan cijene (ručni model): STARTER=29€/mj, PRO=59€/mj, ENTERPRISE=dogovorno.
 * Prihod se evidentira kroz Invoice model (modul za fakturiranje).
 */

import Stripe from "stripe";
import { logWarn } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/appVersion";

export { getAppBaseUrl };

let stripeClient: Stripe | null = null;
let checked = false;

export type BillingPlanId = "starter" | "pro" | "enterprise";

export type PlanDefinition = {
  id: BillingPlanId;
  label: string;
  priceEurMonthly: number;
  features: string[];
  stripePriceEnv?: string;
};

export const PLANS: ReadonlyArray<PlanDefinition> = [
  {
    id: "starter",
    label: "Starter",
    priceEurMonthly: 29,
    features: [
      "Do 500 aparata",
      "Do 200 kupaca",
      "Mjesečni izvještaji",
      "Email podsjetnici",
      "Email podrška",
    ],
    stripePriceEnv: "STRIPE_PRICE_STARTER",
  },
  {
    id: "pro",
    label: "Pro",
    priceEurMonthly: 59,
    features: [
      "Neograničeno aparata i kupaca",
      "Više korisničkih računa",
      "White-label (logo, boje)",
      "Customer portal",
      "Prioritetna podrška",
    ],
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
  {
    id: "enterprise",
    label: "Enterprise",
    priceEurMonthly: 0,
    features: [
      "Sve iz Pro plana",
      "SLA ugovor",
      "Custom integracije",
      "Dedicirani account manager",
      "On-premise opcija",
    ],
  },
];

export function getStripe(): Stripe | null {
  if (checked) return stripeClient;
  checked = true;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    logWarn("stripe_not_configured", { hint: "Set STRIPE_SECRET_KEY to enable Stripe Checkout." });
    return null;
  }
  stripeClient = new Stripe(key);
  return stripeClient;
}

export function isStripeEnabled(): boolean {
  return !!getStripe();
}

export function getStripePriceId(plan: BillingPlanId): string | null {
  const def = PLANS.find((p) => p.id === plan);
  if (!def?.stripePriceEnv) return null;
  const val = process.env[def.stripePriceEnv]?.trim();
  return val ?? null;
}

