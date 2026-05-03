import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { getStripe, getStripePriceId, getAppBaseUrl, type BillingPlanId } from "@/lib/billing";
import { apiHandler } from "@/lib/apiHandler";
import { logInfo } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Kreira Stripe Checkout session za pretplatu.
 * Ako Stripe nije konfiguriran, vraća 501 s uputom — admin treba koristiti ručni model.
 */
export const POST = apiHandler(async (req: Request) => {
  const session = await requireAdminSession();
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      {
        error: "Stripe naplata nije konfigurirana. Kontaktirajte podršku za aktivaciju pretplate.",
        code: "STRIPE_NOT_CONFIGURED",
      },
      { status: 501 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const plan = String(body.plan ?? "starter") as BillingPlanId;
  const priceId = getStripePriceId(plan);
  if (!priceId) {
    return NextResponse.json({ error: `Plan ${plan} nema konfiguriranu Stripe cijenu.` }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { id: true, name: true, email: true, stripeCustomerId: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Tvrtka nije pronađena." }, { status: 404 });
  }

  let stripeCustomerId = company.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: company.name,
      email: company.email ?? undefined,
      metadata: { companyId: company.id },
    });
    stripeCustomerId = customer.id;
    await prisma.company.update({ where: { id: company.id }, data: { stripeCustomerId } });
  }

  const base = getAppBaseUrl();
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/admin/settings/billing?session_id={CHECKOUT_SESSION_ID}&status=success`,
    cancel_url: `${base}/admin/settings/billing?status=canceled`,
    metadata: { companyId: company.id, plan },
  });

  logInfo("stripe_checkout_created", { companyId: company.id, plan, sessionId: checkout.id });

  return NextResponse.json({ url: checkout.url });
});
