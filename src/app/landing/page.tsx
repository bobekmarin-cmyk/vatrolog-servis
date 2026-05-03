import LandingNav from "./_components/LandingNav";
import Hero from "./_components/Hero";
import Problem from "./_components/Problem";
import Benefits from "./_components/Benefits";
import Features from "./_components/Features";
import Workflow from "./_components/Workflow";
import Screenshots from "./_components/Screenshots";
import Pricing from "./_components/Pricing";
import Faq from "./_components/Faq";
import Contact from "./_components/Contact";
import Footer from "./_components/Footer";

export default function LandingPage() {
  return (
    <main id="top" className="flex flex-col">
      <LandingNav />
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
  );
}
