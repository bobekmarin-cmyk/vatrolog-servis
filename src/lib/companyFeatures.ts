import { prisma } from "@/lib/prisma";
import type { AccountRole } from "@/lib/auth";

export const FEATURE_KEYS = {
  DASHBOARD: "DASHBOARD",
  WORK_ORDERS: "WORK_ORDERS",
  EXTINGUISHERS: "EXTINGUISHERS",
  CUSTOMERS: "CUSTOMERS",
  REPORTS_MONTHLY: "REPORTS_MONTHLY",
  CUSTOMER_ANALYTICS: "CUSTOMER_ANALYTICS",
  EMAIL_NOTIFICATIONS: "EMAIL_NOTIFICATIONS",
  ADMIN_SERVICERS: "ADMIN_SERVICERS",
  ADMIN_SETTINGS: "ADMIN_SETTINGS",
  ADMIN_BILLING: "ADMIN_BILLING",
  ADMIN_PRIVACY: "ADMIN_PRIVACY",
  ADMIN_AUDIT: "ADMIN_AUDIT",
  WAREHOUSE: "WAREHOUSE",
  SALES_ORDERS: "SALES_ORDERS",
  SALES_WAREHOUSE: "SALES_WAREHOUSE",
  SCHEDULING: "SCHEDULING",
  CUSTOMER_PORTAL: "CUSTOMER_PORTAL",
  QR_LABELS: "QR_LABELS",
  API_KEYS: "API_KEYS",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export type FeatureAccess = {
  enabledForAdmin: boolean;
  enabledForWorkshop: boolean;
};

// Defaulti su bitni za nove tvrtke (ako u DB nema zapisa).
export const DEFAULT_FEATURES: Record<FeatureKey, FeatureAccess> = {
  DASHBOARD: { enabledForAdmin: true, enabledForWorkshop: true },
  WORK_ORDERS: { enabledForAdmin: true, enabledForWorkshop: true },
  EXTINGUISHERS: { enabledForAdmin: true, enabledForWorkshop: true },
  CUSTOMERS: { enabledForAdmin: true, enabledForWorkshop: false },
  REPORTS_MONTHLY: { enabledForAdmin: true, enabledForWorkshop: false },
  CUSTOMER_ANALYTICS: { enabledForAdmin: true, enabledForWorkshop: false },
  EMAIL_NOTIFICATIONS: { enabledForAdmin: true, enabledForWorkshop: false },
  ADMIN_SERVICERS: { enabledForAdmin: true, enabledForWorkshop: false },
  ADMIN_SETTINGS: { enabledForAdmin: true, enabledForWorkshop: false },
  ADMIN_BILLING: { enabledForAdmin: true, enabledForWorkshop: false },
  ADMIN_PRIVACY: { enabledForAdmin: true, enabledForWorkshop: false },
  ADMIN_AUDIT: { enabledForAdmin: true, enabledForWorkshop: false },
  WAREHOUSE: { enabledForAdmin: true, enabledForWorkshop: true },
  SALES_ORDERS: { enabledForAdmin: true, enabledForWorkshop: false },
  SALES_WAREHOUSE: { enabledForAdmin: true, enabledForWorkshop: false },
  SCHEDULING: { enabledForAdmin: true, enabledForWorkshop: true },
  CUSTOMER_PORTAL: { enabledForAdmin: true, enabledForWorkshop: false },
  QR_LABELS: { enabledForAdmin: true, enabledForWorkshop: true },
  API_KEYS: { enabledForAdmin: true, enabledForWorkshop: false },
};

export async function getCompanyFeatures(companyId: string): Promise<Record<string, FeatureAccess>> {
  const fromDb = await prisma.companyFeature.findMany({
    where: { companyId },
    select: { key: true, enabledForAdmin: true, enabledForWorkshop: true },
  });

  const map: Record<string, FeatureAccess> = { ...DEFAULT_FEATURES };
  for (const f of fromDb) {
    map[f.key] = { enabledForAdmin: f.enabledForAdmin, enabledForWorkshop: f.enabledForWorkshop };
  }
  return map;
}

export function isFeatureEnabledForRole(
  role: AccountRole,
  features: Record<string, FeatureAccess>,
  key: FeatureKey
): boolean {
  const f = features[key] ?? DEFAULT_FEATURES[key];
  if (!f) return false;
  return role === "ADMIN" ? f.enabledForAdmin : f.enabledForWorkshop;
}

