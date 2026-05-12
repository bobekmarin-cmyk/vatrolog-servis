"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CustomerDepartmentsFields from "@/components/CustomerDepartmentsFields";
import { useDialog } from "@/components/ui/useDialog";
import LoadingOverlay from "@/components/LoadingOverlay";

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

export default function NewCustomerFromOibForm({
  from,
}: {
  /**
   * Kontekst odakle je korisnik došao na "Novi kupac" — prosljeđuje se serveru
   * radi pravilnog redirecta nakon spremanja:
   *  - "work-order-new"  → vrati na /work-orders/new s pred-odabranim novim kupcem
   *  - undefined / cokoli drugo → default redirect na /customers
   */
  from?: string | null;
} = {}) {
  const dialog = useDialog();
  const formRef = useRef<HTMLFormElement>(null);
  const navConfirmInFlight = useRef(false);
  const [oib, setOib] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [likelyCraft, setLikelyCraft] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [showDepartments, setShowDepartments] = useState(false);
  const [lastLookupAt, setLastLookupAt] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [oibCheckStatus, setOibCheckStatus] = useState<"idle" | "checking" | "available" | "duplicate">("idle");
  const [oibCheckMessage, setOibCheckMessage] = useState<string | null>(null);
  const [shortNameTouched, setShortNameTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cleanedOib = useMemo(() => oib.replace(/\D/g, ""), [oib]);
  const canLookup = !loading;
  const isDirty = useMemo(
    () =>
      Boolean(
        oib ||
          name ||
          shortName ||
          street ||
          postalCode ||
          city ||
          contactPerson ||
          phone ||
          email ||
          showDepartments
      ),
    [oib, name, shortName, street, postalCode, city, contactPerson, phone, email, showDepartments]
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
      const samePage = link.href === window.location.href;
      if (samePage) return;

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

  async function checkOibAvailability(value: string): Promise<boolean> {
    const normalized = value.replace(/\D/g, "");
    if (normalized.length !== 11) {
      setOibCheckStatus("idle");
      setOibCheckMessage(null);
      return false;
    }
    setOibCheckStatus("checking");
    setOibCheckMessage(null);
    try {
      const res = await fetch(`/api/customers/oib-availability?oib=${normalized}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const payload = (await res.json()) as { available?: boolean; existingCustomer?: { name?: string } | null; error?: string };
      if (!res.ok) {
        setOibCheckStatus("idle");
        setOibCheckMessage(payload.error ?? "Ne mogu provjeriti OIB.");
        return false;
      }
      if (payload.available) {
        setOibCheckStatus("available");
        setOibCheckMessage("OIB je slobodan.");
        return true;
      }
      setOibCheckStatus("duplicate");
      setOibCheckMessage(`OIB je već zauzet (${payload.existingCustomer?.name ?? "postojeći kupac"}).`);
      return false;
    } catch {
      setOibCheckStatus("idle");
      setOibCheckMessage("Ne mogu provjeriti OIB.");
      return false;
    }
  }

  function validateFields() {
    const errors: Record<string, string> = {};
    if (cleanedOib.length !== 11) errors.oib = "OIB mora imati točno 11 znamenki.";
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
    setLookupDone(false);
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
          setName("");
          setShortName("");
          setStreet("");
          setPostalCode("");
          setCity("");
          setEmail("");
          setLookupDone(false);
          setLikelyCraft(true);
          setLookupError(null);
          setLookupSuccess(false);
          setLastLookupAt(null);
        } else {
          setLikelyCraft(false);
          setLookupError(payload.error ?? "Dohvat podataka nije uspio.");
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
      setLookupDone(true);
      setLikelyCraft(false);
      setLookupSuccess(true);
      setLastLookupAt(new Date());
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next.oib;
        return next;
      });
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
    if (oibCheckStatus === "duplicate") {
      e.preventDefault();
      setValidationErrors((prev) => ({ ...prev, oib: "OIB je već zauzet. Unesi drugi OIB." }));
      return;
    }
    setSubmitting(true);
  }

  return (
    <>
    {submitting ? (
      <LoadingOverlay
        title="Spremam kupca..."
        message={
          from === "work-order-new"
            ? "Molimo pričekajte, vraćamo vas na novi radni nalog."
            : "Molimo pričekajte, otvara se popis kupaca."
        }
      />
    ) : null}
    <form ref={formRef} className="surface p-4 space-y-4" action="/api/customers/create" method="post" onSubmit={handleSubmit}>
      <input type="hidden" name="type" value="LEGAL" />
      {from ? <input type="hidden" name="from" value={from} /> : null}

      <div>
        <label className="label">OIB</label>
        <div className="mt-1 flex gap-2">
          <input
            name="oib"
            className="input mt-0"
            required
            value={oib}
            onChange={(e) => {
              const normalized = e.target.value.replace(/\D/g, "").slice(0, 11);
              setOib(normalized);
              setLikelyCraft(false);
              setLookupError(null);
              setLookupSuccess(false);
              setLastLookupAt(null);
              setValidationErrors((prev) => {
                const next = { ...prev };
                delete next.oib;
                return next;
              });
              setOibCheckStatus("idle");
              setOibCheckMessage(null);
            }}
            onBlur={() => {
              void checkOibAvailability(oib);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleLookup();
              }
            }}
            placeholder="Unesi OIB tvrtke (11 znamenki)"
            inputMode="numeric"
            pattern="\d{11}"
          />
          <button type="button" className="btn btn-outline whitespace-nowrap" onClick={handleLookup} disabled={!canLookup}>
            {loading ? "Dohvaćam..." : "Dohvati podatke"}
          </button>
        </div>
        <p className="help">Sustav prvo pokušava dohvat iz Sudskog registra. Ako OIB nije tvrtka, podatke unosiš ručno.</p>
      </div>
      {validationErrors.oib ? <p className="text-xs text-rose-600">{validationErrors.oib}</p> : null}
      {oibCheckStatus === "checking" ? <p className="help">Provjeravam OIB…</p> : null}
      {oibCheckMessage ? (
        <p className={`text-xs ${oibCheckStatus === "duplicate" ? "text-rose-600" : "text-emerald-700"}`}>{oibCheckMessage}</p>
      ) : null}

      {lookupError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{lookupError}</div>
      ) : null}
      {lookupSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Podaci su uspješno dohvaćeni iz Sudskog registra.
        </div>
      ) : null}
      {lastLookupAt ? <p className="help">Zadnje osvježeno iz registra: {lastLookupAt.toLocaleString("hr-HR")}</p> : null}
      {likelyCraft ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nije pronađeno u Sudskom registru — nastavi ručni unos (vjerojatno obrt).
        </div>
      ) : null}

      {(lookupDone || name || shortName || street || postalCode || city) ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Naziv subjekta</label>
              <input name="name" className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
              {validationErrors.name ? <p className="text-xs text-rose-600">{validationErrors.name}</p> : null}
            </div>
            <div>
              <label className="label">Skraćeni naziv</label>
              <input
                name="shortName"
                className="input mt-1"
                value={shortName}
                onChange={(e) => {
                  setShortNameTouched(true);
                  setShortName(e.target.value);
                }}
                placeholder={likelyCraft ? "npr. AUTOPRIJEVOZ HORVAT" : "npr. ACME d.o.o."}
              />
            </div>
          </div>
          <div>
            <label className="label">Ulica i broj</label>
            <input name="street" className="input mt-1" value={street} onChange={(e) => setStreet(e.target.value)} required />
            {validationErrors.street ? <p className="text-xs text-rose-600">{validationErrors.street}</p> : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Poštanski broj</label>
              <input
                name="postalCode"
                className="input mt-1"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                inputMode="numeric"
                pattern="\d{5}"
              />
            </div>
            <div>
              <label className="label">Grad</label>
              <input name="city" className="input mt-1" value={city} onChange={(e) => setCity(e.target.value)} required />
              {validationErrors.city ? <p className="text-xs text-rose-600">{validationErrors.city}</p> : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Naziv subjekta</label>
              <input name="name" className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
              {validationErrors.name ? <p className="text-xs text-rose-600">{validationErrors.name}</p> : null}
            </div>
            <div>
              <label className="label">Skraćeni naziv</label>
              <input
                name="shortName"
                className="input mt-1"
                value={shortName}
                onChange={(e) => {
                  setShortNameTouched(true);
                  setShortName(e.target.value);
                }}
                placeholder={likelyCraft ? "npr. AUTOPRIJEVOZ HORVAT" : "npr. ACME d.o.o."}
              />
            </div>
          </div>
          <div>
            <label className="label">Ulica i broj</label>
            <input name="street" className="input mt-1" value={street} onChange={(e) => setStreet(e.target.value)} required />
            {validationErrors.street ? <p className="text-xs text-rose-600">{validationErrors.street}</p> : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Poštanski broj</label>
              <input
                name="postalCode"
                className="input mt-1"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                inputMode="numeric"
                pattern="\d{5}"
              />
            </div>
            <div>
              <label className="label">Grad</label>
              <input name="city" className="input mt-1" value={city} onChange={(e) => setCity(e.target.value)} required />
              {validationErrors.city ? <p className="text-xs text-rose-600">{validationErrors.city}</p> : null}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Kontakt osoba (opcionalno)</label>
          <input
            name="contactPerson"
            className="input"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Kontakt broj (opcionalno)</label>
          <input name="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Email (opcionalno)</label>
        <input
          name="email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="npr. info@tvrtka.hr"
        />
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

      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <input
          type="checkbox"
          name="autoNotify"
          id="autoNotifyNew"
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <div>
          <label htmlFor="autoNotifyNew" className="text-sm font-medium cursor-pointer">Automatske email obavijesti</label>
          <p className="text-xs text-slate-500">Kupac će automatski dobivati obavijesti o isteku servisa vatrogasnih aparata.</p>
        </div>
      </div>

      <div className="h-px bg-black/10" />
      <div className="space-y-2">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50"
          onClick={() => setShowDepartments((s) => !s)}
          aria-expanded={showDepartments}
          aria-controls="customer-departments-section"
        >
          <span>Odjeljenja (opcionalno)</span>
          <span className="text-slate-500">{showDepartments ? "▾" : "▸"}</span>
        </button>
        {!showDepartments ? (
          <p className="help">Rijetko se koristi — možeš preskočiti i dodati kasnije.</p>
        ) : (
          <div id="customer-departments-section">
            <CustomerDepartmentsFields />
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button className="btn btn-primary px-4" type="submit" disabled={submitting || oibCheckStatus === "checking"}>
          Spremi kupca
        </button>
        <Link
          className="btn btn-outline px-4"
          href={from === "work-order-new" ? "/work-orders/new" : "/customers"}
        >
          Odustani
        </Link>
      </div>
    </form>
    </>
  );
}
