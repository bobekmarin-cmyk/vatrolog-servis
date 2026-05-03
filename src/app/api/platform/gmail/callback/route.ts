import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { exchangePlatformCode, fetchGmailEmail, saveVendorTokens } from "@/lib/platformGmail";
import { verifyOauthState } from "@/lib/platformOauthState";

function redirectErr(req: NextRequest, reason: string) {
  return NextResponse.redirect(
    new URL(`/platform/settings?tab=email&gmail=error&reason=${encodeURIComponent(reason)}`, req.url),
  );
}

export async function GET(req: NextRequest) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.redirect(new URL("/platform/login", req.url));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) return redirectErr(req, oauthError);
  if (!code || !state) return redirectErr(req, "missing_params");

  const stateCheck = await verifyOauthState(state, ps.platformUserId);
  if (!stateCheck.ok) return redirectErr(req, `state_${stateCheck.reason}`);

  try {
    const tokens = await exchangePlatformCode(code);
    const email = await fetchGmailEmail(tokens.access_token);

    await saveVendorTokens({
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      scope: tokens.scope ?? null,
      expiresInSec: tokens.expires_in,
      connectedById: ps.platformUserId,
    });

    await prisma.auditLog.create({
      data: {
        actorType: "PLATFORM",
        action: "platform.gmail.connect",
        entity: "PlatformIntegration",
        entityId: "GMAIL",
        meta: { email, scope: tokens.scope ?? null },
      },
    });

    return NextResponse.redirect(
      new URL("/platform/settings?tab=email&gmail=connected", req.url),
    );
  } catch (e: any) {
    console.error("Platform Gmail callback error:", e);
    return redirectErr(req, (e?.message ?? "unknown").toString().slice(0, 100));
  }
}
