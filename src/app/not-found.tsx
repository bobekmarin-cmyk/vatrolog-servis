import Link from "next/link";
import VatroLogLogo from "@/components/VatroLogLogo";

export const metadata = {
  title: "Stranica nije pronađena",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md surface p-8 shadow-lg text-center space-y-6">
        <Link href="/" aria-label="Natrag na početnu" className="inline-block rounded-md transition hover:opacity-80">
          <VatroLogLogo size="lg" />
        </Link>

        <div className="space-y-2">
          <p className="text-5xl font-bold tabular-nums text-red-600">404</p>
          <h1 className="text-xl font-bold text-slate-900">Stranica nije pronađena</h1>
          <p className="text-sm text-slate-600">
            Tražena stranica više ne postoji ili je premještena. Vratite se na početnu ili
            otvorite svoj račun.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Link href="/" className="btn btn-primary w-full">
            Početna
          </Link>
          <Link href="/login" className="btn btn-outline w-full">
            Prijava u aplikaciju
          </Link>
        </div>
      </div>
    </main>
  );
}
