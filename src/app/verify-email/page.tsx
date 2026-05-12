import VatroLogLogo from "@/components/VatroLogLogo";
import VerifyEmailResendForm from "./VerifyEmailResendForm";
import Link from "next/link";

export const metadata = {
  title: "Potvrda email adrese",
  alternates: { canonical: "/verify-email" },
};

type Props = { searchParams: Promise<{ status?: string }> };

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { status } = await searchParams;

  const isOk = status === "ok";
  const showResend = status === "resend" || status === "invalid";
  const content = isOk ? (
    <div className="text-sm text-green-700 bg-green-50 p-3 rounded">
      Hvala! Vaša email adresa je potvrđena. Sada se možete prijaviti.
    </div>
  ) : (
    <div className="text-sm text-red-700 bg-red-50 p-3 rounded">
      Link za potvrdu nije valjan ili je istekao. Možete zatražiti novu potvrdu emaila.
    </div>
  );

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm surface p-6 shadow-lg">
        <div className="flex justify-center mb-4">
          <Link href="/" aria-label="Natrag na početnu" className="rounded-md transition hover:opacity-80">
            <VatroLogLogo size="lg" />
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Potvrda email adrese</h1>
        <div className="mt-6">{content}</div>
        {showResend && <VerifyEmailResendForm />}
        <div className="mt-6 text-center text-sm space-x-3">
          <a href="/login" className="text-red-600 hover:underline">Idi na prijavu</a>
          <span aria-hidden className="text-slate-400">·</span>
          <a href="/" className="text-slate-600 hover:text-red-600 hover:underline">
            ← Opis proizvoda
          </a>
        </div>
      </div>
    </main>
  );
}
