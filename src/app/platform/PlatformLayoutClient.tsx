"use client";

import { usePathname } from "next/navigation";
import PlatformShell, { type PlatformNavSection } from "@/components/PlatformShell";

const nav: PlatformNavSection[] = [
  {
    items: [{ href: "/platform", label: "Dashboard", icon: "▣" }],
  },
  {
    label: "Serviseri",
    items: [
      { href: "/platform/registration-requests", label: "Zahtjevi", icon: "📨" },
      { href: "/platform/companies", label: "Tvrtke", icon: "🏢" },
    ],
  },
  {
    label: "Kupci i portal",
    items: [
      { href: "/platform/customers", label: "Kupci (po serviseru)", icon: "👥" },
      { href: "/platform/owners", label: "Vlasnici (portal)", icon: "🔑" },
    ],
  },
  {
    label: "Šifrarnici",
    items: [
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
    label: "Operativa",
    items: [
      { href: "/platform/health", label: "Zdravlje sustava", icon: "❤️" },
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
