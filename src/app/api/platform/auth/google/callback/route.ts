import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isEmailAllowedByPlatformPolicy,
  isPlatformGoogleLoginEnabled,
  signPlatformSessionToken,
} from "@/lib/platformAuth";
import { exchangePlatformGoogleCode } from "@/lib/platformGoogleAuth";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  clientKeyFromRequest,
  recordLoginFailure,
} from "@/lib/rateLimit";
import { redirectRelative } from "@/lib/httpRedirect";
import { extractAuditMeta } from "@/lib/auditLog";

const STATE_COOKIE = "vb_platform_google_state";
const SESSION_COOKIE = "vb_platform_session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denyRedirect(reason: string): NextResponse {
  const res = redirectRelative(`/platform/login?google_error=${encodeURIComponent(reason)}`, 303);
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const ipKey = `platform-google:${clientKeyFromRequest(req)}`;
  const blocked = await checkLoginRateLimit(ipKey);
  if (blocked.blocked) return denyRedirect("rate_limited");

  if (!isPlatformGoogleLoginEnabled()) return denyRedirect("google_disabled");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const googleError = req.nextUrl.searchParams.get("error");
  if (googleError) return denyRedirect(`google_${googleError}`);
  if (!code || !state) return denyRedirect("missing_params");

  const cookieState = req.cookies.get(STATE_COOKIE)?.value ?? null;
  if (!cookieState || cookieState !== state) return denyRedirect("state_mismatch");

  const auditMeta = extractAuditMeta(req);

  let identity;
  try {
    identity = await exchangePlatformGoogleCode(code);
  } catch (err) {
    recordLoginFailure(ipKey);
    await prisma.auditLog.create({
      data: {
        actorType: "PLATFORM",
        action: "platform.googleLogin.exchange_failed",
        entity: "PlatformUser",
        meta: { error: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200) },
        ip: auditMeta.ip,
        userAgent: auditMeta.userAgent,
      },
    });
    return denyRedirect("token_exchange_failed");
  }

  if (!isEmailAllowedByPlatformPolicy(identity.email)) {
    recordLoginFailure(ipKey);
    await prisma.auditLog.create({
      data: {
        actorType: "PLATFORM",
        action: "platform.googleLogin.not_allowlisted",
        entity: "PlatformUser",
        meta: { email: identity.email, sub: identity.sub, hd: identity.hostedDomain },
        ip: auditMeta.ip,
        userAgent: auditMeta.userAgent,
      },
    });
    return denyRedirect("not_allowlisted");
  }

  // Mapiranje na PlatformUser:
  //  1) prvi po googleSub-u (stabilan, otporan na promjenu emaila),
  //  2) zatim po email-u (bind za prvu uspjesnu prijavu).
  let user = await prisma.platformUser.findUnique({ where: { googleSub: identity.sub } });
  if (!user) {
    const byEmail = await prisma.platformUser.findUnique({ where: { email: identity.email } });
    if (byEmail) {
      user = await prisma.platformUser.update({
        where: { id: byEmail.id },
        data: { googleSub: identity.sub, lastGoogleLoginAt: new Date() },
      });
    }
  } else {
    user = await prisma.platformUser.update({
      where: { id: user.id },
      data: { lastGoogleLoginAt: new Date() },
    });
  }

  if (!user || !user.active) {
    recordLoginFailure(ipKey);
    await prisma.auditLog.create({
      data: {
        actorType: "PLATFORM",
        action: "platform.googleLogin.no_match",
        entity: "PlatformUser",
        meta: { email: identity.email, sub: identity.sub },
        ip: auditMeta.ip,
        userAgent: auditMeta.userAgent,
      },
    });
    return denyRedirect("no_account");
  }

  clearLoginFailures(ipKey);

  const token = await signPlatformSessionToken({
    platformUserId: user.id,
    role: user.role,
  });

  await prisma.auditLog.create({
    data: {
      actorType: "PLATFORM",
      action: "platform.googleLogin.success",
      entity: "PlatformUser",
      entityId: user.id,
      meta: { email: identity.email, sub: identity.sub },
      ip: auditMeta.ip,
      userAgent: auditMeta.userAgent,
    },
  });

  const res = redirectRelative("/platform/companies", 303);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
