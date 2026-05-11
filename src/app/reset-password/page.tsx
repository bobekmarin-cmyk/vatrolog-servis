import ResetPasswordForm from "./ResetPasswordForm";
import VatroLogLogo from "@/components/VatroLogLogo";
import Link from "next/link";

export const metadata = {
  title: "Postavi novu lozinku",
  alternates: { canonical: "/reset-password" },
};

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm surface p-6 shadow-lg">
        <div className="flex justify-center mb-4">
          <Link href="/landing" aria-label="Natrag na početnu" className="rounded-md transition hover:opacity-80">
            <VatroLogLogo size="lg" />
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Postavi novu lozinku</h1>
        <p className="mt-1 text-sm text-slate-600">Unesite novu lozinku (najmanje 8 znakova).</p>

        <div className="mt-6">
          {token ? <ResetPasswordForm token={token} /> : <p className="text-sm text-red-700 bg-red-50 p-3 rounded">Link nije valjan. Zatražite novi reset.</p>}
        </div>
        <div className="mt-4 text-center text-xs text-slate-600 space-x-3">
          <a href="/login" className="hover:text-red-600 hover:underline">
            Natrag na prijavu
          </a>
          <span aria-hidden>·</span>
          <a href="/landing" className="hover:text-red-600 hover:underline">
            ← Opis proizvoda
          </a>
        </div>
      </div>
    </main>
  );
}
