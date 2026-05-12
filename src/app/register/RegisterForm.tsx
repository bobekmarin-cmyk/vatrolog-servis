"use client";

import Link from "next/link";
import { useId, useState } from "react";

type SuccessState = {
  duplicate: boolean;
  message: string;
};

export default function RegisterForm() {
  // Subjekt
  const [companyName, setCompanyName] = useState("");
  const [oib, setOib] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Kontakt
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [note, setNote] = useState("");

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<SuccessState | null>(null);

  // Stabilni id-evi za pravilno povezivanje labela i polja (a11y).
  const ids = {
    companyName: useId(),
    oib: useId(),
    postalCode: useId(),
    street: useId(),
    city: useId(),
    contactName: useId(),
    contactEmail: useId(),
    contactPhone: useId(),
    note: useId(),
    terms: useId(),
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!termsAccepted) {
      setFieldErrors({ termsAccepted: "Morate prihvatiti uvjete." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          oib: oib.replace(/\D/g, ""),
          street,
          city,
          postalCode,
          contactName: contactName || undefined,
          contactEmail,
          contactPhone: contactPhone || undefined,
          note: note || undefined,
          termsAccepted,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Greška. Pokušajte ponovno.");
        if (data.fields && typeof data.fields === "object") {
          setFieldErrors(data.fields as Record<string, string>);
        }
      } else {
        setSuccess({
          duplicate: Boolean(data.duplicate),
          message:
            data.message ??
            "Zahtjev je zaprimljen. Pregledat ćemo ga i javiti se na e-mail.",
        });
      }
    } catch {
      setError("Greška u komunikaciji s poslužiteljem.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
          <h3 className="font-semibold text-emerald-800">
            {success.duplicate ? "Zahtjev je već u obradi" : "Zahtjev je zaprimljen"}
          </h3>
          <p className="mt-2 text-sm text-emerald-800">{success.message}</p>
          <ul className="mt-3 space-y-1 text-xs text-emerald-700 list-disc pl-5">
            <li>Pregledamo zahtjev i javimo se u roku 1 radnog dana.</li>
            <li>Ako odobrimo, dobit ćete e-mail s pozivnicom za postavljanje lozinki.</li>
            <li>Probni rad od 14 dana kreće tek nakon odobrenja i prihvaćanja pozivnice.</li>
          </ul>
        </div>
        <Link
          href="/"
          className="block text-center rounded-md bg-red-600 text-white py-2 font-medium hover:bg-red-700"
        >
          Natrag na početnu
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Podaci o subjektu</legend>

        <div>
          <label htmlFor={ids.companyName} className="block text-sm">
            Naziv tvrtke / obrta / udruge
          </label>
          <input
            id={ids.companyName}
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="input"
          />
          {fieldErrors.companyName && (
            <p className="mt-1 text-xs text-red-700">{fieldErrors.companyName}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={ids.oib} className="block text-sm">
              OIB / matični broj
            </label>
            <input
              id={ids.oib}
              required
              maxLength={15}
              inputMode="numeric"
              value={oib}
              onChange={(e) => setOib(e.target.value.replace(/\D/g, "").slice(0, 15))}
              className="input mt-0 font-mono"
            />
            {fieldErrors.oib && <p className="mt-1 text-xs text-red-700">{fieldErrors.oib}</p>}
          </div>
          <div>
            <label htmlFor={ids.postalCode} className="block text-sm">
              Poštanski broj
            </label>
            <input
              id={ids.postalCode}
              required
              value={postalCode}
              onChange={(e) =>
                setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))
              }
              inputMode="numeric"
              className="input"
            />
            {fieldErrors.postalCode && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.postalCode}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor={ids.street} className="block text-sm">
            Adresa (ulica i kućni broj)
          </label>
          <input
            id={ids.street}
            required
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className="input"
          />
          {fieldErrors.street && (
            <p className="mt-1 text-xs text-red-700">{fieldErrors.street}</p>
          )}
        </div>

        <div>
          <label htmlFor={ids.city} className="block text-sm">
            Grad
          </label>
          <input
            id={ids.city}
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="input"
          />
          {fieldErrors.city && <p className="mt-1 text-xs text-red-700">{fieldErrors.city}</p>}
        </div>
      </fieldset>

      <fieldset className="space-y-3 pt-2 border-t border-slate-200">
        <legend className="text-sm font-semibold text-slate-700 pt-2">
          Kontakt osoba
        </legend>

        <div>
          <label htmlFor={ids.contactName} className="block text-sm">
            Ime i prezime <span className="text-slate-400">(neobavezno)</span>
          </label>
          <input
            id={ids.contactName}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            autoComplete="name"
            className="input"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={ids.contactEmail} className="block text-sm">
              E-mail
            </label>
            <input
              id={ids.contactEmail}
              type="email"
              required
              autoComplete="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="input"
            />
            {fieldErrors.contactEmail && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.contactEmail}</p>
            )}
          </div>
          <div>
            <label htmlFor={ids.contactPhone} className="block text-sm">
              Telefon <span className="text-slate-400">(neobavezno)</span>
            </label>
            <input
              id={ids.contactPhone}
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              autoComplete="tel"
              className="input"
            />
          </div>
        </div>

        <div>
          <label htmlFor={ids.note} className="block text-sm">
            Napomena <span className="text-slate-400">(neobavezno)</span>
          </label>
          <textarea
            id={ids.note}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Npr. broj radionica, postojeći sustav, željeni početak…"
            className="input min-h-[72px]"
          />
        </div>
      </fieldset>

      <label
        htmlFor={ids.terms}
        className="flex items-start gap-2 text-sm text-slate-700 pt-2"
      >
        <input
          id={ids.terms}
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-1"
        />
        <span>
          Prihvaćam{" "}
          <a href="/legal/terms" target="_blank" className="text-red-600 hover:underline">
            uvjete korištenja
          </a>{" "}
          i{" "}
          <a href="/legal/privacy" target="_blank" className="text-red-600 hover:underline">
            politiku privatnosti
          </a>
          .
        </span>
      </label>
      {fieldErrors.termsAccepted && (
        <p className="text-xs text-red-700">{fieldErrors.termsAccepted}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary h-11 w-full disabled:opacity-50"
      >
        {submitting ? "Šaljemo zahtjev..." : "Pošalji zahtjev za probni pristup"}
      </button>

      <p className="text-xs text-slate-500">
        Ne tražimo lozinku ni broj kartice. Ako odobrimo zahtjev, dobit ćete e-mail s
        pozivnicom za postavljanje korisničkih računa i početak 14-dnevnog probnog rada.
      </p>

      {error && <p className="text-sm text-red-700 bg-red-50 p-2 rounded">{error}</p>}
    </form>
  );
}
