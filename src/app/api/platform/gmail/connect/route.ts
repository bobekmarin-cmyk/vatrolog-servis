import { NextRequest, NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platformAuth";
import { buildPlatformConsentUrl } from "@/lib/platformGmail";
import { createOauthState } from "@/lib/platformOauthState";

import { redirectRelative } from "@/lib/httpRedirect";
export async function GET(req: NextRequest) {
  const ps = await getPlatformSession();
  if (!ps) {
    return redirectRelative("/platform/login", 307);
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return redirectRelative("/platform/settings?tab=email&gmail=error&reason=missing_oauth_env", 307);
  }
  const state = await createOauthState(ps.platformUserId);
  return NextResponse.redirect(buildPlatformConsentUrl(state));
}
