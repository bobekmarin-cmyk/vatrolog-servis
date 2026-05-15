import { redirect } from "next/navigation";
import PlatformLoginForm from "./PlatformLoginForm";
import { getPlatformSession, isPlatformGoogleLoginEnabled } from "@/lib/platformAuth";

const GOOGLE_ERROR_LABELS: Record<string, string> = {
  google_disabled: "Google prijava za platformu trenutno nije aktivna.",
  rate_limited: "Previše pokušaja prijave. Pričekaj minutu pa pokušaj ponovno.",
  state_mismatch: "Sigurnosna provjera nije prošla. Pokušaj ponovno.",
  missing_params: "Google nije vratio očekivane parametre.",
  token_exchange_failed: "Razmjena Google tokena nije uspjela.",
  not_allowlisted: "Ovaj Google račun nije na popisu dozvoljenih.",
  no_account: "Nemaš dodijeljen platform račun za ovu email adresu.",
};

export default async function PlatformLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ google_error?: string }>;
}) {
  // DB-validirana provjera (ne samo JWT): ako stvarno postoji aktivni platform user,
  // preusmjeri ga na companies. Ako cookie postoji ali user ne (stale JWT) → ostani na login formi.
  const ps = await getPlatformSession();
  if (ps) redirect("/platform/companies");

  const googleEnabled = isPlatformGoogleLoginEnabled();
  const params = await searchParams;
  const errCode = params.google_error;
  const errLabel = errCode
    ? GOOGLE_ERROR_LABELS[errCode] ?? `Google prijava nije uspjela (${errCode}).`
    : null;

  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm surface p-5 shadow-lg rounded-xl">
        <h1 className="text-xl font-bold">Platform prijava</h1>
        <p className="mt-0.5 text-sm text-slate-600">Ultra admin sučelje (vendor).</p>

        {errLabel && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errLabel}
          </div>
        )}

        {googleEnabled && (
          <div className="mt-4">
            <a
              href="/api/platform/auth/google/start"
              className="btn btn-outline h-10 w-full inline-flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.836.861-3.048.861-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.964 10.71A5.41 5.41 0 0 1 3.68 9c0-.593.102-1.17.284-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                />
              </svg>
              Prijava Google računom
            </a>
            <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
              <div className="h-px flex-1 bg-slate-200" />
              <span>ili</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </div>
        )}

        <div className="mt-4">
          <PlatformLoginForm />
        </div>
      </div>
    </main>
  );
}
