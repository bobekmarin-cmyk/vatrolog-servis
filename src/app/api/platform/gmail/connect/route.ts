import { NextRequest, NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platformAuth";
import { buildPlatformConsentUrl } from "@/lib/platformGmail";
import { createOauthState } from "@/lib/platformOauthState";

export async function GET(req: NextRequest) {
  const ps = await getPlatformSession();
  if (!ps) {
    return NextResponse.redirect(new URL("/platform/login", req.url));
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL("/platform/settings?tab=email&gmail=error&reason=missing_oauth_env", req.url),
    );
  }
  const state = await createOauthState(ps.platformUserId);
  return NextResponse.redirect(buildPlatformConsentUrl(state));
}
