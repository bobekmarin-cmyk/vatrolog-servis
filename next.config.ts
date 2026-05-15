import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy.
 *
 * Pokrenuto u Report-Only modu — pratimo nepravilnosti u Sentry/console-u prije
 * nego što policy zaključamo (enforce). Ako ti treba enforce mode, postavi
 * `CSP_ENFORCE=1` u env-u.
 */
const cspDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  // Next.js hidrira preko inline script tagova; bez nonce-a koristimo 'unsafe-inline'.
  // (nonce strategija je opcija kasnije, kad postavimo middleware za injekciju.)
  "script-src": ["'self'", "'unsafe-inline'"],
  // Tailwind generira utility klase u <style> i u inline-style atributima.
  "style-src": ["'self'", "'unsafe-inline'"],
  // QR kodovi se serviraju kao PNG (same-origin) i ponekad kao data: URL.
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  // Google OAuth (token exchange + userinfo), Gmail send API, Sentry, Stripe API.
  "connect-src": [
    "'self'",
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
    "https://gmail.googleapis.com",
    "https://accounts.google.com",
    "https://api.stripe.com",
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    "https://*.ingest.us.sentry.io",
    "https://*.ingest.de.sentry.io",
  ],
  "frame-ancestors": ["'none'"],
  // OAuth redirect se događa preko top-level navigacije (window.location), ne form post —
  // 'self' je dovoljno.
  "form-action": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
};

if (isProd) {
  cspDirectives["upgrade-insecure-requests"] = [];
}

const cspValue = Object.entries(cspDirectives)
  .map(([k, v]) => (v.length === 0 ? k : `${k} ${v.join(" ")}`))
  .join("; ");

const cspHeaderName =
  process.env.CSP_ENFORCE === "1" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";

const securityHeaders = [
  // Hard requirement za HTTPS; tek nakon punog HTTPS rollouta razmotri `preload`.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: ["camera=()", "microphone=()", "geolocation=()", "browsing-topics=()"].join(", "),
  },
  { key: cspHeaderName, value: cspValue },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/landing",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
