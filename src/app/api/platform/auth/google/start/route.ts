import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  buildPlatformGoogleConsentUrl,
  isPlatformGoogleLoginEnabled,
} from "@/lib/platformGoogleAuth";

const STATE_COOKIE = "vb_platform_google_state";
const STATE_TTL_SEC = 600; // 10 min

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inicira Google OAuth flow za platform login.
 *
 * State CSRF zastita: random vrijednost se istovremeno salje Google-u u `state`
 * parametru i postavlja kao httpOnly cookie; callback uspoređuje oba.
 */
export async function GET() {
  if (!isPlatformGoogleLoginEnabled()) {
    return NextResponse.json(
      {
        error:
          "Google prijava za platformu nije omogucena. Postavi PLATFORM_GOOGLE_ALLOWED_EMAILS ili PLATFORM_GOOGLE_ALLOWED_DOMAINS i provjeri GOOGLE_CLIENT_ID/SECRET.",
        code: "PLATFORM_GOOGLE_DISABLED",
      },
      { status: 503 },
    );
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const consentUrl = buildPlatformGoogleConsentUrl(state);

  const res = NextResponse.redirect(consentUrl, 303);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_TTL_SEC,
  });
  return res;
}
