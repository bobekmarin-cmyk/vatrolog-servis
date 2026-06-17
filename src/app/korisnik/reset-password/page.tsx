import VatroLogLogo from "@/components/VatroLogLogo";
import OwnerResetPasswordForm from "./OwnerResetPasswordForm";

export const metadata = {
  title: "Korisnički portal — nova lozinka",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

type PageProps = { searchParams: Promise<{ token?: string }> };

export default async function OwnerResetPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <main className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm surface p-6 shadow-lg">
        <div className="flex justify-center mb-4">
          <VatroLogLogo size="lg" />
        </div>
        <h1 className="text-2xl font-bold">Nova lozinka</h1>
        <p className="mt-1 text-sm text-slate-600">Postavite novu lozinku za svoj račun.</p>
        <div className="mt-6">
          <OwnerResetPasswordForm token={token ?? ""} />
        </div>
      </div>
    </main>
  );
}
