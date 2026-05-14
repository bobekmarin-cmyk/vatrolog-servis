import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { getVendorStatus } from "@/lib/platformGmail";
import { getBillingMode } from "@/lib/billing";

export async function GET() {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  let dbOk = false;
  let dbLatencyMs: number | null = null;
  const t0 = Date.now();
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    dbOk = true;
    dbLatencyMs = Date.now() - t0;
  } catch (e: any) {
    dbOk = false;
  }

  const vendor = await getVendorStatus();

  const smtpConfigured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );

  const stripeWebhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
  const billingMode = getBillingMode();
  const stripeManual = billingMode === "manual";
  const stripeOk = stripeManual || (stripeConfigured && stripeWebhookConfigured);

  return NextResponse.json({
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    vendorGmail: vendor,
    smtp: { configured: smtpConfigured, host: process.env.SMTP_HOST ?? null },
    stripe: {
      mode: billingMode,
      ok: stripeOk,
      configured: stripeConfigured,
      webhookConfigured: stripeWebhookConfigured,
    },
    env: {
      googleClient: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
      vendorFromEmail: process.env.VENDOR_FROM_EMAIL ?? null,
      authSecret: !!process.env.AUTH_SECRET,
      platformAuthSecret: !!process.env.PLATFORM_AUTH_SECRET,
    },
    serverTime: new Date().toISOString(),
  });
}
