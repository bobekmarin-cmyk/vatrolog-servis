import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { getStripe, getAppBaseUrl } from "@/lib/billing";
import { apiHandler } from "@/lib/apiHandler";

export const runtime = "nodejs";

/**
 * Stripe Customer Portal — kupac mijenja karticu, otkazuje plan, dohvaća račune.
 */
export const POST = apiHandler(async () => {
  const session = await requireAdminSession();
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe nije konfiguriran." }, { status: 501 });
  }
  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { stripeCustomerId: true },
  });
  if (!company?.stripeCustomerId) {
    return NextResponse.json({ error: "Nema Stripe kupca. Prvo pokrenite checkout." }, { status: 400 });
  }
  const portal = await stripe.billingPortal.sessions.create({
    customer: company.stripeCustomerId,
    return_url: `${getAppBaseUrl()}/admin/settings/billing`,
  });
  return NextResponse.json({ url: portal.url });
});
