import { getSession, getSubscriptionInfo } from "@/lib/auth";
import { FEATURE_KEYS, getCompanyFeatures, isFeatureEnabledForRole } from "@/lib/companyFeatures";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import CompanyShell, { type CompanyNavItem, type CompanyNavSection } from "@/components/CompanyShell";
import SubscriptionExpiryBadge from "@/components/SubscriptionExpiryBadge";
import DialogProvider from "@/components/ui/DialogProvider";
import { countUnreadForAccount } from "@/lib/notifications";

/**
 * Sve tenant rute (dashboard, radni nalozi, kupci, aparati, skladište, izvještaji, admin)
 * su iza prijave — eksplicitno ih oznacavamo kao noindex,nofollow tako da Lighthouse SEO
 * test ne snižava ocjenu na internom UI-ju, a tražilice (Google/Bing) koje slučajno dođu
 * do auth wall-a ne pokušavaju ih dalje obraditi.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

type NavItemConfig = CompanyNavItem & { featureKey: keyof typeof FEATURE_KEYS; adminOnly?: boolean };
type NavSectionConfig = {
  title?: string;
  items: NavItemConfig[];
  inactiveSection?: boolean;
  collapsible?: boolean;
};

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const subInfo = await getSubscriptionInfo(session.companyId);
  if (subInfo.status !== "active") {
    redirect("/subscription-expired");
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { name: true },
  });

  if (!company) {
    redirect("/api/auth/logout");
  }

  const features = await getCompanyFeatures(session.companyId);

  const sectionsAll: NavSectionConfig[] = [
    {
      items: [{ href: "/dashboard", label: "Dashboard", icon: "📊", featureKey: "DASHBOARD" }],
    },
    {
      title: "SERVIS",
      items: [
        { href: "/work-orders", label: "Radni nalozi", icon: "🧾", featureKey: "WORK_ORDERS" },
        {
          href: "/work-orders/delivery-notes",
          label: "Otpremnice",
          icon: "📄",
          featureKey: "WORK_ORDERS",
          adminOnly: true,
          activePathPrefixes: ["/work-orders/delivery-notes"],
        },
        {
          href: "/warehouse/parts",
          label: "Skladište – dijelovi",
          icon: "📦",
          featureKey: "WAREHOUSE",
          activePathPrefixes: ["/warehouse/parts", "/warehouse/manufacturer", "/warehouse/receipts"],
        },
        {
          href: "/warehouse/labels",
          label: "Skladište – naljepnice",
          icon: "🏷️",
          featureKey: "WAREHOUSE",
          activePathPrefixes: ["/warehouse/labels"],
        },
        {
          href: "/qr-naljepnice",
          label: "QR naljepnice",
          icon: "🔳",
          featureKey: "QR_LABELS",
          activePathPrefixes: ["/qr-naljepnice"],
        },
      ],
    },
    {
      title: "PRODAJA",
      inactiveSection: true,
      items: [
        { href: "/sales/orders", label: "Prodajni nalozi", icon: "🛒", featureKey: "SALES_ORDERS" },
        {
          href: "/sales/warehouse",
          label: "Skladište – prodaja",
          icon: "📦",
          featureKey: "SALES_WAREHOUSE",
        },
      ],
    },
    {
      title: "IZVJEŠTAJI",
      collapsible: true,
      items: [
        { href: "/customers", label: "Kupci", icon: "🏢", featureKey: "CUSTOMERS" },
        { href: "/reports/monthly", label: "Plan servisa", icon: "📅", featureKey: "REPORTS_MONTHLY" },
        { href: "/reports/email-log", label: "Poslana pošta", icon: "✉️", featureKey: "REPORTS_MONTHLY" },
        {
          href: "/reports/operations",
          label: "Servisna analitika",
          icon: "📈",
          featureKey: "REPORTS_MONTHLY",
          activePathPrefixes: ["/reports/operations"],
          adminOnly: true,
        },
        { href: "/extinguishers", label: "Aparati", icon: "🧯", featureKey: "EXTINGUISHERS" },
      ],
    },
    {
      title: "Admin",
      collapsible: true,
      items: [
        { href: "/admin/users", label: "Korisnici", icon: "👥", featureKey: "ADMIN_SETTINGS" },
        { href: "/admin/settings", label: "Postavke", icon: "⚙️", featureKey: "ADMIN_SETTINGS" },
        { href: "/notifications", label: "Obavijesti", icon: "🔔", featureKey: "ADMIN_SETTINGS" },
      ],
    },
  ];

  const unreadNotifications = await countUnreadForAccount({
    accountUserId: session.accountUserId,
    role: session.role,
  });

  const sections: CompanyNavSection[] = sectionsAll
    .map((section) => ({
      title: section.title,
      inactiveSection: section.inactiveSection,
      collapsible: section.collapsible,
      items: section.items
        .filter((i) => {
          if (i.href === "/notifications") return session.role === "ADMIN";
          if (i.adminOnly && session.role !== "ADMIN") return false;
          return isFeatureEnabledForRole(session.role, features, FEATURE_KEYS[i.featureKey]);
        })
        .map(
          (i): CompanyNavItem => ({
            href: i.href,
            label: i.label,
            icon: i.icon,
            activePathPrefixes: i.activePathPrefixes,
            badgeCount: i.href === "/notifications" ? unreadNotifications : undefined,
          }),
        ),
    }))
    .filter((section) => section.items.length > 0);

  const roleLabel = session.role === "ADMIN" ? "Admin" : "Serviser";

  const expiryBadge =
    subInfo.expiringSoon && subInfo.activeUntil && subInfo.daysUntilExpiry !== null ? (
      <SubscriptionExpiryBadge
        daysUntilExpiry={subInfo.daysUntilExpiry}
        activeUntilIso={subInfo.activeUntil.toISOString()}
      />
    ) : null;

  return (
    <DialogProvider>
      <CompanyShell
        companyName={company?.name ?? "Tvrtka"}
        roleLabel={roleLabel}
        sections={sections}
        topBarExtra={expiryBadge}
      >
        {children}
      </CompanyShell>
    </DialogProvider>
  );
}
