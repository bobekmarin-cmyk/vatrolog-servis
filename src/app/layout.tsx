// src/app/layout.tsx (root wrapper – bez “company” sidebara)
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { getAppBaseUrl } from "@/lib/appVersion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppBaseUrl()),
  title: {
    default: "VatroLog — Digitalna evidencija servisa vatrogasnih aparata",
    template: "%s | VatroLog",
  },
  description:
    "Baza kupaca, servisni nalozi, skladište dijelova, ovlaštenja, naljepnice, otpremnice i upisnici u jednom alatu. Razvijeno u suradnji sa serviserima.",
  applicationName: "VatroLog",
  keywords: [
    "vatrogasni aparati",
    "servis vatrogasnih aparata",
    "VatroLog",
    "radni nalog",
    "evidencija aparata",
    "Hrvatska",
  ],
  openGraph: {
    title: "VatroLog — Digitalna evidencija servisa vatrogasnih aparata",
    description:
      "Digitalna evidencija servisa bez papira i Excela. Kupci, nalozi, skladište, ovlaštenja, naljepnice, otpremnice i upisnici u jednom alatu.",
    locale: "hr_HR",
    type: "website",
    url: "/",
    siteName: "VatroLog",
    // Image se generira preko app/opengraph-image.tsx (Next.js auto-injecta meta tagove).
  },
  twitter: {
    card: "summary_large_image",
    title: "VatroLog — Digitalna evidencija servisa vatrogasnih aparata",
    description:
      "Baza kupaca, servisni nalozi, skladište dijelova, ovlaštenja, naljepnice, otpremnice i upisnici u jednom alatu.",
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
