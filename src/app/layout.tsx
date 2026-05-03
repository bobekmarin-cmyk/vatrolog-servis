// src/app/layout.tsx (root wrapper – bez “company” sidebara)
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";
import { ToastProvider } from "@/components/ui/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL?.trim() || "https://vatrolog.hr"),
  title: {
    default: "VatroLog — Digitalni servis vatrogasnih aparata",
    template: "%s | VatroLog",
  },
  description:
    "Servisni nalozi, evidencija aparata, skladište, upisnici i izvještaji na jednom mjestu. Za servisere vatrogasnih aparata u Hrvatskoj.",
  applicationName: "VatroLog",
  keywords: [
    "vatrogasni aparati",
    "servis vatrogasnih aparata",
    "VatroLog",
    "radni nalog",
    "evidencija aparata",
    "Hrvatska",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "VatroLog — Digitalni servis vatrogasnih aparata",
    description:
      "Vodi servis vatrogasnih aparata bez papira i Excela. Nalozi, evidencija, upisnici i izvještaji u jednom alatu.",
    locale: "hr_HR",
    type: "website",
    url: "/",
    siteName: "VatroLog",
    // Image se generira preko app/opengraph-image.tsx (Next.js auto-injecta meta tagove).
  },
  twitter: {
    card: "summary_large_image",
    title: "VatroLog — Digitalni servis vatrogasnih aparata",
    description:
      "Servisni nalozi, evidencija aparata, skladište, upisnici i izvještaji na jednom mjestu.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ToastProvider>
          {children}
          <CookieBanner />
        </ToastProvider>
      </body>
    </html>
  );
}
