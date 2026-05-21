import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/appVersion";

/**
 * Sitemap pokriva samo public marketing/legal stranice. Auth helper stranice
 * (/login, /forgot-password, /reset-password, /verify-email, /subscription-expired)
 * su `noindex` i izvan sitemape — Google ih ne treba indeksirati niti trošiti
 * crawl proračun na njih. Tenant/admin/platform prostor je u potpunosti iza
 * autentikacije i također nije u sitemapi.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppBaseUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/dpa`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/legal/impressum`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/legal/google-api`, lastModified: now, changeFrequency: "yearly", priority: 0.1 },
  ];
}
