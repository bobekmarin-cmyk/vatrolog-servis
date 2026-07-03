/**
 * SaaS naplata: Stripe (ako je konfiguriran) ili ručni / predračun model.
 *
 * Ručni vs Stripe model:
 *  - Ako nema STRIPE_SECRET_KEY ili je BILLING_MODE=manual, online Stripe Checkout
 *    i Customer Portal nisu aktivni (pretplata se vodi ručno / predračunom).
 *
 * Stripe env varijable (sve opcionalne u stripe modu):
 *  - STRIPE_SECRET_KEY
 *  - STRIPE_WEBHOOK_SECRET
 *  - STRIPE_PRICE_START  (npr. price_1AbCdE... za mjesečni Start plan)
 *  - STRIPE_PRICE_STANDARD
 *  - STRIPE_PRICE_PREMIUM
 *
 * Planovi prate SubscriptionPlan enum (START / STANDARD / PREMIUM) i
 * capability gating u src/lib/subscriptionPlan.ts.
 * Prihod se evidentira kroz Invoice model (modul za fakturiranje).
 */

import Stripe from "stripe";
import { logWarn } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/appVersion";

export { getAppBaseUrl };

let stripeClient: Stripe | null = null;
let checked = false;

export type BillingPlanId = "start" | "standard" | "premium";

export type PlanDefinition = {
  id: BillingPlanId;
  label: string;
  /** Vrijednost SubscriptionPlan enuma kojoj ovaj plan odgovara. */
  planEnum: "START" | "STANDARD" | "PREMIUM";
  priceEurMonthly: number;
  features: string[];
  stripePriceEnv?: string;
};

export type BillingMode = "manual" | "stripe";

/** Ručni model: nema Stripe ključa ili eksplicitno BILLING_MODE=manual. */
export function getBillingMode(): BillingMode {
  if (process.env.BILLING_MODE?.trim().toLowerCase() === "manual") return "manual";
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return "manual";
  return "stripe";
}

export const PLANS: ReadonlyArray<PlanDefinition> = [
  {
    id: "start",
    label: "Start",
    planEnum: "START",
    priceEurMonthly: 29,
    features: [
      "Radni nalozi, primke, upisnici i otpremnice (PDF)",
      "Evidencija aparata i kupaca",
      "Skladište dijelova i naljepnica",
      "Šifrarnici i cjenici",
      "QR naljepnice za aparate",
      "Email podrška",
    ],
    stripePriceEnv: "STRIPE_PRICE_START",
  },
  {
    id: "standard",
    label: "Standard",
    planEnum: "STANDARD",
    priceEurMonthly: 59,
    features: [
      "Sve iz Start plana",
      "Slanje dokumenata mailom (Gmail / SMTP)",
      "Automatske email obavijesti kupcima",
      "Korisnički portal za kupce",
      "Plan servisa i podsjetnici",
      "Prioritetna podrška",
    ],
    stripePriceEnv: "STRIPE_PRICE_STANDARD",
  },
  {
    id: "premium",
    label: "Premium",
    planEnum: "PREMIUM",
    priceEurMonthly: 89,
    features: [
      "Sve iz Standard plana",
      "Integracija s e-računima (automatski računi)",
      "Rabati po kupcu i kategorijama",
      "Računi vidljivi u korisničkom portalu",
      "Buduće integracije za fakturiranje",
    ],
    stripePriceEnv: "STRIPE_PRICE_PREMIUM",
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
  if (getBillingMode() === "manual") return false;
  return !!getStripe();
}

export function getStripePriceId(plan: BillingPlanId): string | null {
  const def = PLANS.find((p) => p.id === plan);
  if (!def?.stripePriceEnv) return null;
  const val = process.env[def.stripePriceEnv]?.trim();
  return val ?? null;
}

