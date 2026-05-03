// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VatroLog",
  description: "Servisni nalozi i evidencija vatrogasnih aparata",
};

function NavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: string;
}) {
  // client-side active state radimo s CSS-om preko aria-current:
  // Next ne zna aktivnu rutu u server komponenti bez dodatnog hooka,
  // ali ovo je OK: highlight će se odraditi pomoću :global u globals.css
  // ili preko "data-active" ako kasnije pređeš na client nav.
  return (
    <Link
      href={href}
      className="group flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-gray-100"
    >
      <span className="w-5 text-center">{icon ?? "•"}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-dvh bg-white">
          <div className="mx-auto max-w-7xl">
            <div className="flex">
              {/* SIDEBAR */}
              <aside className="sticky top-0 h-dvh w-64 border-r bg-white">
                <div className="p-4">
                  <div className="text-lg font-bold">
                    <span className="text-slate-900">Vatro</span>
                    <span className="text-red-600">Log</span>
                  </div>
                  <div className="text-xs text-gray-500">Servisni sustav</div>
                </div>

                <nav className="px-2 pb-6">
                  <NavItem href="/dashboard" label="Dashboard" icon="📊" />

                  <div className="my-3 border-t" />

                  <NavItem href="/work-orders" label="Radni nalozi" icon="🧾" />

                  <div className="my-3 border-t" />

                  <NavItem href="/customers" label="Kupci" icon="🏢" />
                  <NavItem href="/reports/monthly" label="Plan servisa" icon="📅" />
                  <NavItem href="/reports/email-log" label="Poslana pošta" icon="✉️" />
                  <NavItem href="/servicers" label="Serviseri" icon="🧑‍🔧" />
                </nav>
              </aside>

              {/* CONTENT */}
              <div className="min-w-0 flex-1">
                <div className="p-0">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
