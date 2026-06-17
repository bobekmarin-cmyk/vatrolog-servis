import Link from "next/link";
import VatroLogLogo from "@/components/VatroLogLogo";
import OwnerForgotPasswordForm from "./OwnerForgotPasswordForm";

export const metadata = {
  title: "Korisnički portal — zaboravljena lozinka",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function OwnerForgotPasswordPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm surface p-6 shadow-lg">
        <div className="flex justify-center mb-4">
          <VatroLogLogo size="lg" />
        </div>
        <h1 className="text-2xl font-bold">Zaboravljena lozinka</h1>
        <p className="mt-1 text-sm text-slate-600">Pošaljite si link za postavljanje nove lozinke.</p>
        <div className="mt-6">
          <OwnerForgotPasswordForm />
        </div>
        <div className="mt-4 text-xs text-slate-500">
          <Link href="/korisnik/login" className="hover:text-red-600 hover:underline">← Natrag na prijavu</Link>
        </div>
      </div>
    </main>
  );
}
