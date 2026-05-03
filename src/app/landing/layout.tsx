import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VatroLog — Digitalni servis vatrogasnih aparata",
  description:
    "Servisni nalozi, evidencija aparata, skladište, upisnici i izvještaji na jednom mjestu. Za servisere vatrogasnih aparata u Hrvatskoj.",
  openGraph: {
    title: "VatroLog — Digitalni servis vatrogasnih aparata",
    description:
      "Vodi servis vatrogasnih aparata bez papira i Excela. Nalozi, evidencija, upisnici i izvještaji u jednom alatu.",
    locale: "hr_HR",
    type: "website",
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white text-slate-900">{children}</div>;
}
