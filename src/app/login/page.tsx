import CompanyLoginForm from "./CompanyLoginForm";
import VatroLogLogo from "@/components/VatroLogLogo";
import Link from "next/link";

export const metadata = {
  title: "Prijava",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm surface p-6 shadow-lg">
        <div className="flex justify-center mb-4">
          <Link href="/" aria-label="Natrag na početnu" className="rounded-md transition hover:opacity-80">
            <VatroLogLogo size="lg" />
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Prijava</h1>
        <p className="mt-1 text-sm text-slate-600">Prijavi se svojim korisničkim računom tvrtke.</p>

        <div className="mt-6">
          <CompanyLoginForm />
        </div>

        <div className="mt-4 flex justify-between text-xs text-slate-500">
          <Link href="/forgot-password" className="hover:text-red-600 hover:underline">
            Zaboravljena lozinka?
          </Link>
          <Link href="/register" className="hover:text-red-600 hover:underline">
            Zatraži probni pristup
          </Link>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Ako nemaš pristupne podatke, javi se administratoru tvrtke.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Niste dobili potvrdu emaila?{" "}
          <Link href="/verify-email?status=resend" className="hover:text-red-600 hover:underline">
            Pošaljite novu potvrdu.
          </Link>
        </p>

        <div className="mt-6 border-t border-slate-200 pt-4 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-red-600 hover:underline">
            ← Natrag na opis proizvoda
          </Link>
        </div>
      </div>
    </main>
  );
}
