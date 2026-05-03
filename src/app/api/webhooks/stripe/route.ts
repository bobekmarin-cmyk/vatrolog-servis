import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/billing";
import { logError, logInfo, logWarn } from "@/lib/logger";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionWithPeriodEnd = Stripe.Subscription & {
  current_period_end?: number;
};

type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  period_end?: number;
};

/**
 * Stripe webhook za sinkronizaciju pretplate.
 * Events:
 *  - invoice.paid              -> produži activeUntil
 *  - customer.subscription.updated / deleted -> ažuriraj stripeSubscriptionId, trialEndsAt, activeUntil
 *  - invoice.payment_failed    -> postavi activeUntil na grace period (7 dana)
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe nije konfiguriran." }, { status: 501 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logWarn("stripe_webhook_secret_missing");
    return NextResponse.json({ error: "Webhook secret nije konfiguriran." }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Nedostaje stripe-signature." }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (err) {
    logError("stripe_webhook_signature_invalid", err);
    return NextResponse.json({ error: "Neispravan potpis." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const companyId = s.metadata?.companyId;
        if (companyId && typeof s.subscription === "string") {
          await prisma.company.update({
            where: { id: companyId },
            data: {
              stripeSubscriptionId: s.subscription,
              stripeCustomerId: typeof s.customer === "string" ? s.customer : undefined,
            },
          });
          logInfo("stripe_checkout_completed", { companyId, subscription: s.subscription });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as SubscriptionWithPeriodEnd;
        const periodEnd = (sub.current_period_end ?? Math.floor(Date.now() / 1000)) * 1000;
        const item = sub.items.data[0];
        const company = await prisma.company.findFirst({
          where: {
            OR: [
              { stripeSubscriptionId: sub.id },
              ...(typeof sub.customer === "string" ? [{ stripeCustomerId: sub.customer }] : []),
            ],
          },
          select: { id: true },
        });
        if (!company) {
          logWarn("stripe_subscription_no_company", { subscriptionId: sub.id });
          break;
        }
        await prisma.company.update({
          where: { id: company.id },
          data: {
            activeUntil: new Date(periodEnd),
            stripeSubscriptionId: sub.id,
            stripeCustomerId: typeof sub.customer === "string" ? sub.customer : undefined,
            stripePriceId: item?.price.id ?? null,
            blocked: sub.status === "unpaid" || sub.status === "canceled",
            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          },
        });
        await prisma.auditLog.create({
          data: {
            companyId: company.id,
            actorType: "SYSTEM",
            action: "subscription.updated",
            entity: "Company",
            entityId: company.id,
            meta: { status: sub.status, priceId: item?.price.id, activeUntil: new Date(periodEnd).toISOString() },
          },
        });
        logInfo("stripe_subscription_synced", { companyId: company.id, status: sub.status });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const company = await prisma.company.findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { id: true },
        });
        if (company) {
          await prisma.company.update({
            where: { id: company.id },
            data: { stripeSubscriptionId: null, activeUntil: new Date(), blocked: false },
          });
          logInfo("stripe_subscription_cancelled", { companyId: company.id });
        }
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as InvoiceWithSubscription;
        if (inv.subscription && typeof inv.subscription === "string") {
          const company = await prisma.company.findFirst({
            where: { stripeSubscriptionId: inv.subscription },
            select: { id: true },
          });
          if (company && inv.period_end) {
            await prisma.company.update({
              where: { id: company.id },
              data: { activeUntil: new Date(inv.period_end * 1000), blocked: false },
            });
            logInfo("stripe_invoice_paid", { companyId: company.id, amount: inv.amount_paid });
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as InvoiceWithSubscription;
        if (inv.subscription && typeof inv.subscription === "string") {
          const company = await prisma.company.findFirst({
            where: { stripeSubscriptionId: inv.subscription },
            select: { id: true, activeUntil: true },
          });
          if (company) {
            // 7-dnevni grace period
            const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const newActiveUntil = company.activeUntil && company.activeUntil > gracePeriodEnd
              ? gracePeriodEnd
              : company.activeUntil;
            await prisma.company.update({
              where: { id: company.id },
              data: { activeUntil: newActiveUntil ?? gracePeriodEnd },
            });
            logWarn("stripe_invoice_payment_failed", { companyId: company.id });
          }
        }
        break;
      }
      default:
        logInfo("stripe_webhook_unhandled", { type: event.type });
    }
  } catch (err) {
    logError("stripe_webhook_processing_failed", err, { type: event.type });
    return NextResponse.json({ error: "Greška u obradi." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
