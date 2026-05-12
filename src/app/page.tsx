import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import LandingNav from "./_landing/LandingNav";
import Hero from "./_landing/Hero";
import Problem from "./_landing/Problem";
import Benefits from "./_landing/Benefits";
import Features from "./_landing/Features";
import Workflow from "./_landing/Workflow";
import Screenshots from "./_landing/Screenshots";
import Pricing from "./_landing/Pricing";
import Faq from "./_landing/Faq";
import Contact from "./_landing/Contact";
import Footer from "./_landing/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VatroLog — Digitalni servis vatrogasnih aparata",
  description:
    "Servisni nalozi, evidencija aparata, skladište, upisnici i izvještaji na jednom mjestu. Za servisere vatrogasnih aparata u Hrvatskoj.",
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
  },
};

export default async function RootPage() {
  const session = await getSession();
  const isAuthenticated = Boolean(session);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main id="top" className="flex flex-col">
        <LandingNav isAuthenticated={isAuthenticated} />
        <Hero />
        <Problem />
        <Benefits />
        <Features />
        <Workflow />
        <Screenshots />
        <Pricing />
        <Faq />
        <Contact />
        <Footer />
      </main>
    </div>
  );
}
