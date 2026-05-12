import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/appVersion";

/**
 * Sitemap pokriva samo public stranice. Tenant/admin/platform prostor
 * nije za indeksiranje.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppBaseUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/dpa`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/legal/impressum`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
