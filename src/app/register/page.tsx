import RegisterForm from "./RegisterForm";
import VatroLogLogo from "@/components/VatroLogLogo";
import Link from "next/link";

export const metadata = {
  title: "Zahtjev za probni pristup",
  description:
    "Pošaljite zahtjev za 30-dnevni probni rad u VatroLogu. Pregledavamo zahtjev isti radni dan i odobravamo ga ručno — bez kartice, bez automatske aktivacije.",
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-lg surface p-6 shadow-lg">
        <div className="flex justify-center mb-4">
          <Link href="/" aria-label="Natrag na početnu" className="rounded-md transition hover:opacity-80">
            <VatroLogLogo size="lg" />
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Zahtjev za probni pristup</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pošaljite zahtjev i pregledat ćemo ga isti radni dan. Po odobrenju
          dobivate e-mail s pozivnicom za postavljanje korisničkih računa i 30-dnevni
          probni rad — bez kartice i bez automatske naplate. Uz dogovor dolazimo s prezentacijom programa uživo na vašu lokaciju.
        </p>

        <div className="mt-6">
          <RegisterForm />
        </div>

        <div className="mt-4 text-center text-xs text-slate-600 space-x-3">
          <a href="/" className="hover:text-red-600 hover:underline">
            ← Natrag na opis proizvoda
          </a>
          <span aria-hidden>·</span>
          <a href="/login" className="hover:text-red-600 hover:underline">
            Već imate račun? Prijava
          </a>
        </div>
      </div>
    </main>
  );
}
