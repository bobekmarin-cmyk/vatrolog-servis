import VatroLogLogo from "@/components/VatroLogLogo";
import VerifyEmailResendForm from "./VerifyEmailResendForm";

export const metadata = { title: "Potvrda email adrese" };

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
          <VatroLogLogo size="lg" />
        </div>
        <h1 className="text-2xl font-bold">Potvrda email adrese</h1>
        <div className="mt-6">{content}</div>
        {showResend && <VerifyEmailResendForm />}
        <div className="mt-6 text-center">
          <a href="/login" className="text-sm text-red-600 hover:underline">Idi na prijavu</a>
        </div>
      </div>
    </main>
  );
}
