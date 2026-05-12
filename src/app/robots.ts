import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/appVersion";

/**
 * Javne (marketing) rute mogu se indeksirati. Sve ostalo (auth, admin,
 * platform, API i tenant prostor) blokiramo iz public crawlera; ionako
 * vraćaju 401/302 anonimnim korisnicima, ali ovako čistimo crawler proračun.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getAppBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/legal/"],
        disallow: [
          "/api/",
          "/dashboard",
          "/admin/",
          "/platform/",
          "/work-orders",
          "/customers",
          "/extinguishers",
          "/warehouse",
          "/sales/",
          "/reports/",
          "/auth/",
          "/setup-required",
          "/subscription-expired",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
