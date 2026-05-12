"use client";

import { usePathname } from "next/navigation";
import PlatformShell, { type PlatformNavItem } from "@/components/PlatformShell";

const nav: PlatformNavItem[] = [
  { href: "/platform", label: "Dashboard", icon: "▣" },
  { href: "/platform/registration-requests", label: "Zahtjevi", icon: "📨" },
  { href: "/platform/companies", label: "Tvrtke", icon: "🏢" },
  { href: "/platform/customers", label: "Kupci", icon: "👥" },
  { href: "/platform/manufacturers", label: "Proizvođači", icon: "🏭" },
  { href: "/platform/katalog", label: "Katalog", icon: "📚" },
  { href: "/platform/notifications", label: "Obavijesti", icon: "🔔" },
  { href: "/platform/audit", label: "Audit log", icon: "🛡️" },
  { href: "/platform/email-templates", label: "Email predlošci", icon: "✉️" },
  { href: "/platform/email-log", label: "Email log", icon: "📧" },
  { href: "/platform/settings", label: "Postavke", icon: "⚙️" },
];

export default function PlatformLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/platform/login") {
    return <>{children}</>;
  }
  return (
    <PlatformShell title="Platform" roleLabel="Owner" nav={nav}>
      {children}
    </PlatformShell>
  );
}
