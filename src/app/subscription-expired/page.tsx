import Link from "next/link";
import VatroLogLogo from "@/components/VatroLogLogo";

export const metadata = {
  title: "Pristup onemogućen",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function SubscriptionExpiredPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md surface p-8 shadow-lg text-center space-y-6">
        <Link href="/" aria-label="Natrag na početnu" className="inline-block rounded-md transition hover:opacity-80">
          <VatroLogLogo size="lg" />
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Pristup onemogućen</h1>
          <p className="text-sm text-slate-600">
            Vaša pretplata je istekla ili je račun blokiran. Za obnovu pristupa javite se
            podršci kako bismo produžili pretplatu ili poslali ponudu za nastavak korištenja.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <a href="mailto:info@vatrolog.com?subject=Obnova%20VatroLog%20pretplate" className="btn btn-primary w-full">
            Zatraži obnovu pretplate
          </a>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn btn-outline w-full">
              Odjava
            </button>
          </form>
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700 underline">
            Povratak na prijavu
          </Link>
        </div>
      </div>
    </main>
  );
}
