"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useDialog } from "@/components/ui/useDialog";

type RegistryResponse = {
  oib: string;
  name: string;
  shortName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  address: string;
  email: string | null;
};

type Props = {
  customerId: string;
  initial: {
    name: string;
    shortName: string | null;
    oib: string;
    street: string | null;
    postalCode: string | null;
    city: string | null;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    note: string | null;
    autoNotify: boolean;
  };
};

export default function EditCustomerFormWithLookup({ customerId, initial }: Props) {
  const dialog = useDialog();
  const navConfirmInFlight = useRef(false);
  const [oib] = useState(initial.oib);
  const [name, setName] = useState(initial.name);
  const [shortName, setShortName] = useState(initial.shortName ?? "");
  const [street, setStreet] = useState(initial.street ?? "");
  const [postalCode, setPostalCode] = useState(initial.postalCode ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [contactPerson, setContactPerson] = useState(initial.contactPerson ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [note, setNote] = useState(initial.note ?? "");
  const [autoNotify, setAutoNotify] = useState(initial.autoNotify);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [likelyCraft, setLikelyCraft] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState(false);
  const [lastLookupAt, setLastLookupAt] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [shortNameTouched, setShortNameTouched] = useState(false);

  const cleanedOib = useMemo(() => oib.replace(/\D/g, ""), [oib]);
  const canLookup = !loading;
  const isDirty = useMemo(
    () =>
      name !== initial.name ||
      shortName !== (initial.shortName ?? "") ||
      street !== (initial.street ?? "") ||
      postalCode !== (initial.postalCode ?? "") ||
      city !== (initial.city ?? "") ||
      contactPerson !== (initial.contactPerson ?? "") ||
      phone !== (initial.phone ?? "") ||
      email !== (initial.email ?? "") ||
      note !== (initial.note ?? "") ||
      autoNotify !== initial.autoNotify,
    [name, shortName, street, postalCode, city, contactPerson, phone, email, note, autoNotify, initial]
  );

  useEffect(() => {
    if (!shortNameTouched && !shortName.trim() && name.trim().length > 0) {
      setShortName(name.trim());
    }
  }, [name, shortName, shortNameTouched]);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty || submitting) return;
      e.preventDefault();
      e.returnValue = "";
    };

    const onDocumentClick = (e: MouseEvent) => {
      if (!isDirty || submitting) return;
      if (navConfirmInFlight.current) return;
      const target = e.target as HTMLElement | null;
      const link = target?.closest("a") as HTMLAnchorElement | null;
      if (!link || !link.href) return;
      if (link.href === window.location.href) return;

      e.preventDefault();
      e.stopPropagation();
      const targetHref = link.href;
      navConfirmInFlight.current = true;

      dialog
        .confirm({
          title: "Nespremljene izmjene",
          message: "Imaš nespremljene izmjene. Želiš napustiti stranicu?",
          confirmLabel: "Napusti",
          danger: true,
        })
        .then((ok) => {
          navConfirmInFlight.current = false;
          if (ok) window.location.href = targetHref;
        });
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [isDirty, submitting, dialog]);

  function validateFields() {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Naziv subjekta je obavezan.";
    if (!street.trim()) errors.street = "Ulica i broj su obavezni.";
    if (!city.trim()) errors.city = "Grad je obavezan.";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleLookup() {
    if (!canLookup) return;
    if (cleanedOib.length !== 11) {
      setLookupError("OIB mora imati točno 11 znamenki.");
      setLikelyCraft(false);
      setLookupSuccess(false);
      return;
    }

    setLoading(true);
    setLookupError(null);
    setLikelyCraft(false);
    setLookupSuccess(false);
    setLastLookupAt(null);

    try {
      const res = await fetch(`/api/customers/registry-lookup?oib=${cleanedOib}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const payload = (await res.json()) as RegistryResponse & { error?: string };

      if (!res.ok) {
        if (res.status === 404) {
          setLikelyCraft(true);
          setLookupError(null);
          setLookupSuccess(false);
        } else {
          setLookupError(payload.error ?? "Dohvat podataka nije uspio.");
          setLikelyCraft(false);
          setLookupSuccess(false);
        }
        return;
      }

      setName(payload.name ?? "");
      setShortName(payload.shortName ?? "");
      setStreet(payload.street ?? "");
      setPostalCode(payload.postalCode ?? "");
      setCity(payload.city ?? "");
      setEmail(payload.email ?? "");
      setLookupSuccess(true);
      setLikelyCraft(false);
      setLastLookupAt(new Date());
    } catch {
      setLookupError("Ne mogu dohvatiti podatke iz registra. Pokušaj ponovno.");
      setLookupSuccess(false);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!validateFields()) {
      e.preventDefault();
      return;
    }
    setSubmitting(true);
  }

  return (
    <form className="space-y-4" action={`/api/customers/${customerId}/update`} method="post" onSubmit={handleSubmit}>
      <div>
        <label className="label">OIB</label>
        <div className="mt-1 flex gap-2">
          <input
            name="oib_display"
            className="input mt-0"
            value={oib}
            readOnly
            inputMode="numeric"
            pattern="\d{11}"
            title="OIB se ne može mijenjati nakon kreiranja kupca."
          />
          <input type="hidden" name="oib" value={oib} />
          <button type="button" className="btn btn-outline whitespace-nowrap" onClick={handleLookup} disabled={!canLookup}>
            {loading ? "Dohvaćam..." : "Dohvati podatke"}
          </button>
        </div>
        <p className="help">OIB je zaključan. Po njemu možeš osvježiti naziv i adresu prema registru.</p>
      </div>
      {lastLookupAt ? <p className="help">Zadnje osvježeno iz registra: {lastLookupAt.toLocaleString("hr-HR")}</p> : null}

      {lookupError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{lookupError}</div>
      ) : null}
      {lookupSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Podaci su uspješno dohvaćeni iz Sudskog registra.
        </div>
      ) : null}
      {likelyCraft ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nije pronađeno u Sudskom registru — vjerojatno se radi o obrtu/fizičkoj osobi. Podatke unesi ručno.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Naziv subjekta</label>
          <input name="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          {validationErrors.name ? <p className="text-xs text-rose-600">{validationErrors.name}</p> : null}
        </div>
        <div>
          <label className="label">Skraćeni naziv</label>
          <input
            name="shortName"
            className="input"
            value={shortName}
            onChange={(e) => {
              setShortNameTouched(true);
              setShortName(e.target.value);
            }}
          />
        </div>
      </div>

      <div>
        <label className="label">Ulica i broj</label>
        <input name="street" className="input" value={street} onChange={(e) => setStreet(e.target.value)} required />
        {validationErrors.street ? <p className="text-xs text-rose-600">{validationErrors.street}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Poštanski broj</label>
          <input
            name="postalCode"
            className="input"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            inputMode="numeric"
            pattern="\d{5}"
          />
        </div>
        <div>
          <label className="label">Grad</label>
          <input name="city" className="input" value={city} onChange={(e) => setCity(e.target.value)} required />
          {validationErrors.city ? <p className="text-xs text-rose-600">{validationErrors.city}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Kontakt osoba</label>
          <input name="contactPerson" className="input" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        </div>
        <div>
          <label className="label">Kontakt broj</label>
          <input name="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Email</label>
        <input name="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="help">
        {phone ? (
          <button
            type="button"
            className="underline"
            onClick={() => {
              void navigator.clipboard.writeText(phone);
            }}
          >
            Kopiraj kontakt broj
          </button>
        ) : null}
        {phone && email ? " · " : null}
        {email ? (
          <a className="underline" href={`mailto:${email}`}>
            Otvori email klijent
          </a>
        ) : null}
      </div>

      <div>
        <label className="label">Napomena</label>
        <textarea name="note" className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <input
          type="checkbox"
          name="autoNotify"
          id="autoNotify"
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
          checked={autoNotify}
          onChange={(e) => setAutoNotify(e.target.checked)}
        />
        <div>
          <label htmlFor="autoNotify" className="text-sm font-medium cursor-pointer">Automatske email obavijesti</label>
          <p className="text-xs text-slate-500">Kupac će automatski dobivati obavijesti o isteku servisa vatrogasnih aparata.</p>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button className="btn btn-primary px-4" type="submit" disabled={submitting}>
          Spremi
        </button>
        <Link className="btn btn-outline px-4" href="/customers">
          Odustani
        </Link>
      </div>
    </form>
  );
}
