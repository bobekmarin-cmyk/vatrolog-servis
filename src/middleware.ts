import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { resolveAuthJwtSecret, resolvePlatformJwtSecret } from "@/lib/authEnv";
import { getAppBaseUrl, getPublicAppUrl } from "@/lib/appVersion";

type AccountRole = "ADMIN" | "WORKSHOP";
type PlatformRole = "OWNER";

type SessionInfo = {
  role: AccountRole;
  setupComplete: boolean;
  activeUntilTs: number;
  blocked: boolean;
  isVendorImpersonation: boolean;
};

async function readSession(req: NextRequest): Promise<null | SessionInfo> {
  const token = req.cookies.get("vb_session")?.value;
  if (!token) return null;

  const secret = resolveAuthJwtSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = payload.role;
    if (role !== "ADMIN" && role !== "WORKSHOP") return null;
    const setupComplete = payload.setupComplete;
    const activeUntilTs = typeof payload.activeUntilTs === "number" ? payload.activeUntilTs : 0;
    const blocked = typeof payload.blocked === "boolean" ? payload.blocked : false;
    const isVendorImpersonation =
      typeof payload.isVendorImpersonation === "boolean" ? payload.isVendorImpersonation : false;
    return {
      role,
      setupComplete: typeof setupComplete === "boolean" ? setupComplete : true,
      activeUntilTs,
      blocked,
      isVendorImpersonation,
    };
  } catch {
    return null;
  }
}

function isSubscriptionActive(session: SessionInfo): boolean {
  if (session.blocked) return false;
  if (session.activeUntilTs > 0 && session.activeUntilTs < Date.now()) return false;
  return true;
}

/**
 * Putovi koji moraju raditi i nakon isteka pretplate
 * (logout, stranica /subscription-expired, auth API).
 */
function isAllowedWhenExpired(pathname: string): boolean {
  if (pathname === "/subscription-expired") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/login") return true;
  return false;
}

async function readPlatformSession(req: NextRequest): Promise<null | { role: PlatformRole }> {
  const token = req.cookies.get("vb_platform_session")?.value;
  if (!token) return null;

  const secret = resolvePlatformJwtSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = payload.role;
    if (role !== "OWNER") return null;
    return { role };
  } catch {
    return null;
  }
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login") return true;
  if (pathname === "/register") return true;
  if (pathname === "/forgot-password") return true;
  if (pathname === "/reset-password") return true;
  if (pathname === "/verify-email") return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname === "/subscription-expired") return true;
  if (pathname === "/api/health") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/portal/")) return true;
  if (pathname.startsWith("/legal/")) return true;
  // Favicon / PWA / OG slike (bez sesije — preglednici i društvene mreže).
  if (pathname === "/icon" || pathname === "/apple-icon" || pathname === "/opengraph-image") {
    return true;
  }
  // Dev-only capture rute za generiranje landing PNG mockupa.
  // Sama stranica vraća 404 u produkciji (defense in depth).
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/capture/")) {
    return true;
  }
  return false;
}

function isRestrictedForWorkshop(pathname: string): boolean {
  // WORKSHOP ne smije vidjeti admin sekcije i izvještaje/analize
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/reports")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  if (pathname.startsWith("/api/reports")) return true;
  return false;
}

function isWriteMethod(method: string): boolean {
  const m = method.toUpperCase();
  return !(m === "GET" || m === "HEAD" || m === "OPTIONS");
}

/**
 * Javni origin zahtjeva (Railway/Vercel — x-forwarded-*). Bez ovoga
 * req.nextUrl.origin često nije https javna domena pa CSRF blokira login.
 */
function getInboundOrigin(req: NextRequest): string {
  const protoRaw = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const hostRaw =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.split(",")[0]?.trim();
  if (hostRaw) {
    const proto = protoRaw === "http" || protoRaw === "https" ? protoRaw : "https";
    return `${proto}://${hostRaw}`;
  }
  return req.nextUrl.origin;
}

function addTrustedHost(hosts: Set<string>, raw: string | null | undefined) {
  const t = raw?.trim();
  if (!t) return;
  try {
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    hosts.add(new URL(withScheme).host.toLowerCase());
  } catch {
    /* ignore */
  }
}

/** Host (.host uključuje ne-default port) — pouzdanije od punog string usporedb origin-a iza proxyja. */
function collectTrustedHosts(req: NextRequest): Set<string> {
  const hosts = new Set<string>();
  addTrustedHost(hosts, getInboundOrigin(req));
  addTrustedHost(hosts, getAppBaseUrl());
  addTrustedHost(hosts, getPublicAppUrl());
  addTrustedHost(hosts, req.nextUrl.origin);
  addTrustedHost(hosts, req.headers.get("x-forwarded-host")?.split(",")[0]);
  addTrustedHost(hosts, req.headers.get("host")?.split(",")[0]);
  const rail = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (rail) addTrustedHost(hosts, rail);

  const extras = process.env.CSRF_ALLOWED_HOSTS?.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  for (const e of extras ?? []) addTrustedHost(hosts, e);

  return hosts;
}

function hostFromClientSource(originOrReferer: string): string | null {
  try {
    return new URL(originOrReferer).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * CSRF zaštita preko Origin/Referer provjere (same-origin policy).
 * Pokriva sve mutacijske API pozive. Webhook-ovi i cron ne koriste cookie sesiju
 * pa ih preskačemo.
 *
 * Usporedba po hostu (ne puni origin string): Railway/proxy često kvare shemu/port u odnosu na ono što preglednik šalje.
 */
function csrfCheckPasses(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const pathname = req.nextUrl.pathname;
  if (!pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;

  const trustedHosts = collectTrustedHosts(req);

  const origin = req.headers.get("origin");
  if (origin && origin !== "null") {
    const h = hostFromClientSource(origin);
    return h !== null && trustedHosts.has(h);
  }

  const referer = req.headers.get("referer");
  if (referer) {
    const h = hostFromClientSource(referer);
    return h !== null && trustedHosts.has(h);
  }

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!csrfCheckPasses(req)) {
    return NextResponse.json(
      { error: "CSRF zaštita: nedozvoljen izvor zahtjeva.", code: "CSRF_BLOCKED" },
      { status: 403 },
    );
  }

  const isPlatformPath =
    pathname === "/platform" ||
    pathname.startsWith("/platform/") ||
    pathname.startsWith("/api/platform/");

  if (isPlatformPath) {
    const ps = await readPlatformSession(req);

    // Public platform rute
    if (pathname === "/platform/login" || pathname.startsWith("/api/platform/auth/")) {
      // ako je već ulogiran, preskoči login
      if (pathname === "/platform/login" && ps) {
        const url = req.nextUrl.clone();
        url.pathname = "/platform/companies";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    // sve ostalo zahtijeva platform sesiju
    if (!ps) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/platform/login";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  const session = await readSession(req);

  // /login: redirect ako je već prijavljen rješava login/layout.tsx + getSession (DB), ne middleware
  // Public rute su dostupne bez sesije
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Sve ostalo zahtijeva login
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Pretplata: ako istekla ili blokirana, dozvoli samo /subscription-expired, logout i auth API.
  if (!isSubscriptionActive(session) && !isAllowedWhenExpired(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: session.blocked
            ? "Vaša tvrtka je blokirana."
            : "Pretplata je istekla. Obnovite pretplatu za nastavak rada.",
          code: session.blocked ? "SUBSCRIPTION_BLOCKED" : "SUBSCRIPTION_EXPIRED",
        },
        { status: 402 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/subscription-expired";
    return NextResponse.redirect(url);
  }

  // Role-based zabrane
  if (session.role === "WORKSHOP" && isRestrictedForWorkshop(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nemate ovlasti za ovu radnju." }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.set("forbidden", "1");
    return NextResponse.redirect(url);
  }

  // Vendor impersonation: read-only by default.
  const vendorImpersonationCookie = req.cookies.get("vb_impersonation_mode")?.value === "1";
  const vendorImpersonation = session.isVendorImpersonation && vendorImpersonationCookie;
  const writeEnabled = req.cookies.get("vb_impersonation_write")?.value === "1";
  if (vendorImpersonation && isWriteMethod(req.method) && pathname.startsWith("/api/")) {
    if (!writeEnabled && !pathname.startsWith("/api/auth/logout")) {
      return NextResponse.json(
        {
          error: "Vendor access mode je read-only. Uključite write mode za ovu radnju.",
          code: "VENDOR_IMPERSONATION_READ_ONLY",
        },
        { status: 403 },
      );
    }
  }

  // Setup gating: dok admin ne popuni obavezne podatke tvrtke
  if (!session.setupComplete) {
    // uvijek dozvoli logout
    if (pathname.startsWith("/api/auth/logout")) return NextResponse.next();

    if (session.role === "ADMIN") {
      // admin smije samo u Postavke + admin API dok ne popuni podatke
      if (pathname.startsWith("/admin/settings") || pathname.startsWith("/api/admin/")) {
        return NextResponse.next();
      }
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Potrebno je dovršiti postavke tvrtke." }, { status: 409 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/admin/settings";
      url.searchParams.set("setup", "1");
      return NextResponse.redirect(url);
    }

    // WORKSHOP: info screen
    if (pathname === "/setup-required") return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Admin mora dovršiti postavke tvrtke." }, { status: 409 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/setup-required";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // sve osim Next internals i statike (favicon, public assete poput /landing/* i /portal/* mockup PNG-ova)
    "/((?!_next/static|_next/image|favicon.ico|landing/).*)",
  ],
};

