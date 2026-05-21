import ForgotPasswordForm from "./ForgotPasswordForm";
import VatroLogLogo from "@/components/VatroLogLogo";
import Link from "next/link";

export const metadata = {
  title: "Zaboravljena lozinka",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm surface p-6 shadow-lg">
        <div className="flex justify-center mb-4">
          <Link href="/" aria-label="Natrag na početnu" className="rounded-md transition hover:opacity-80">
            <VatroLogLogo size="lg" />
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Zaboravljena lozinka</h1>
        <p className="mt-1 text-sm text-slate-600">
          Unesite email adresu vezanu uz Vaš račun. Poslat ćemo Vam link za postavljanje nove lozinke.
        </p>

        <div className="mt-6">
          <ForgotPasswordForm />
        </div>

        <div className="mt-4 text-center text-xs text-slate-600 space-x-3">
          <Link href="/login" className="hover:text-red-600 hover:underline">
            Natrag na prijavu
          </Link>
          <span aria-hidden>·</span>
          <Link href="/" className="hover:text-red-600 hover:underline">
            ← Opis proizvoda
          </Link>
        </div>
      </div>
    </main>
  );
}
