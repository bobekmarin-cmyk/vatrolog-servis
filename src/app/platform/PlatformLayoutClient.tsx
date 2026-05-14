"use client";

import { usePathname } from "next/navigation";
import PlatformShell, { type PlatformNavSection } from "@/components/PlatformShell";

const nav: PlatformNavSection[] = [
  {
    items: [{ href: "/platform", label: "Dashboard", icon: "▣" }],
  },
  {
    label: "Onboarding",
    items: [
      { href: "/platform/registration-requests", label: "Zahtjevi", icon: "📨" },
      { href: "/platform/companies", label: "Tvrtke", icon: "🏢" },
    ],
  },
  {
    label: "Sadržaj",
    items: [
      { href: "/platform/customers", label: "Kupci", icon: "👥" },
      { href: "/platform/manufacturers", label: "Proizvođači", icon: "🏭" },
      { href: "/platform/katalog", label: "Katalog", icon: "📚" },
    ],
  },
  {
    label: "Komunikacija",
    items: [
      { href: "/platform/notifications", label: "Obavijesti", icon: "🔔" },
      { href: "/platform/email-templates", label: "Email predlošci", icon: "✉️" },
      { href: "/platform/email-log", label: "Email log", icon: "📧" },
    ],
  },
  {
    label: "Sustav",
    items: [
      { href: "/platform/audit", label: "Audit log", icon: "🛡️" },
      { href: "/platform/settings", label: "Postavke", icon: "⚙️" },
    ],
  },
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
