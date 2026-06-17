import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/appVersion";

/**
 * Javne marketing/legal rute mogu se indeksirati (i `/register` kao landing za
 * probni pristup). Sve ostalo (auth helperi, admin, platform, API i tenant
 * prostor) blokiramo iz public crawlera; ionako vraćaju 401/302 anonimnim
 * korisnicima, ali ovako čistimo crawler proračun i smanjujemo broj
 * "Page with redirect" upozorenja u Google Search Console.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getAppBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/register", "/legal/"],
        disallow: [
          "/api/",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/dashboard",
          "/admin/",
          "/platform/",
          "/work-orders",
          "/customers",
          "/extinguishers",
          "/warehouse",
          "/sales/",
          "/reports/",
          "/notifications",
          "/auth/",
          "/portal/",
          "/korisnik",
          "/capture/",
          "/setup-required",
          "/subscription-expired",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
