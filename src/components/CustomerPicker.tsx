"use client";

import { useEffect, useMemo, useState } from "react";

type CustomerDTO = {
  id: string;
  name: string;
  shortName?: string | null;
  oib: string;
  address: string;
  contactPerson: string | null;
  phone: string | null;
};

type RegistryResponse = {
  oib: string;
  name: string;
  shortName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  email: string | null;
};

export type CustomerPickerProps = {
  name?: string;              // ime hidden inputa u formi (npr. customerId)
  defaultCustomerId?: string; // ako ikad bude edit
  defaultCustomer?: CustomerDTO | null;
  required?: boolean;
  onChange?: (customer: CustomerDTO | null) => void;
  enableQuickCreate?: boolean;
};

export default function CustomerPicker({
  name = "customerId",
  defaultCustomerId = "",
  defaultCustomer = null,
  required = true,
  onChange,
  enableQuickCreate = false,
}: CustomerPickerProps) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CustomerDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CustomerDTO | null>(defaultCustomer);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);
  const [quickCreateSuccess, setQuickCreateSuccess] = useState<string | null>(null);
  const [quickLookupLoading, setQuickLookupLoading] = useState(false);
  const [quickLookupSuccess, setQuickLookupSuccess] = useState<string | null>(null);
  const [quickLookupError, setQuickLookupError] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState({
    oib: "",
    name: "",
    shortName: "",
    street: "",
    postalCode: "",
    city: "",
    contactPerson: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    if (!defaultCustomer) return;
    // prikazujemo odabrani blok; q nam ne treba, ali ostavimo uredno
    setQ(`${defaultCustomer.shortName ?? defaultCustomer.name} (${defaultCustomer.oib})`);
  }, [defaultCustomer]);

  useEffect(() => {
    let alive = true;

    async function run() {
      const term = q.trim();
      if (term.length < 2) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        if (!alive) return;
        setItems(json.items ?? []);
      } finally {
        if (alive) setLoading(false);
      }
    }

    const t = setTimeout(run, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const hint = useMemo(() => {
    if (!selected) return "";
    return `${selected.address}${selected.contactPerson ? ` · ${selected.contactPerson}` : ""}${
      selected.phone ? ` · ${selected.phone}` : ""
    }`;
  }, [selected]);

  function updateQuickField(name: keyof typeof quickForm, value: string) {
    setQuickForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleQuickCreate() {
    setQuickCreateError(null);
    setQuickCreateSuccess(null);
    const normalizedOib = quickForm.oib.replace(/\D/g, "").slice(0, 11);
    if (normalizedOib.length !== 11) {
      setQuickCreateError("OIB mora imati točno 11 znamenki.");
      return;
    }
    if (!quickForm.name.trim() || !quickForm.street.trim() || !quickForm.city.trim()) {
      setQuickCreateError("Obavezno: naziv, ulica i broj, grad.");
      return;
    }

    setQuickCreateLoading(true);
    try {
      const res = await fetch("/api/customers/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...quickForm,
          oib: normalizedOib,
        }),
      });
      const json = (await res.json()) as { error?: string; customer?: CustomerDTO };
      if (!res.ok || !json.customer) {
        setQuickCreateError(json.error ?? "Ne mogu kreirati kupca.");
        return;
      }
      setQuickCreateSuccess("Kupac je uspješno dodan.");
      setSelected(json.customer);
      setQ(`${json.customer.shortName ?? json.customer.name} (${json.customer.oib})`);
      setItems([]);
      setShowQuickCreate(false);
      onChange?.(json.customer);
    } catch {
      setQuickCreateError("Ne mogu kreirati kupca.");
    } finally {
      setQuickCreateLoading(false);
    }
  }

  async function handleQuickLookup() {
    setQuickLookupError(null);
    setQuickLookupSuccess(null);
    const normalizedOib = quickForm.oib.replace(/\D/g, "").slice(0, 11);
    if (normalizedOib.length !== 11) {
      setQuickLookupError("OIB mora imati točno 11 znamenki.");
      return;
    }
    setQuickLookupLoading(true);
    try {
      const res = await fetch(`/api/customers/registry-lookup?oib=${normalizedOib}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const payload = (await res.json()) as RegistryResponse & { error?: string };
      if (!res.ok) {
        setQuickLookupError(payload.error ?? "Dohvat iz registra nije uspio.");
        return;
      }
      setQuickForm((prev) => ({
        ...prev,
        oib: payload.oib ?? normalizedOib,
        name: payload.name ?? prev.name,
        shortName: payload.shortName ?? prev.shortName,
        street: payload.street ?? prev.street,
        postalCode: payload.postalCode ?? prev.postalCode,
        city: payload.city ?? prev.city,
        email: payload.email ?? prev.email,
      }));
      setQuickLookupSuccess("Podaci su uspješno dohvaćeni iz registra.");
    } catch {
      setQuickLookupError("Ne mogu dohvatiti podatke iz registra.");
    } finally {
      setQuickLookupLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="label">Kupac</label>

      <input type="hidden" name={name} value={selected?.id ?? defaultCustomerId ?? ""} />

      {!selected ? (
        <>
          <input
            className="input"
            placeholder="Upiši ime, OIB, kontakt osobu ili telefon…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSelected(null);
              onChange?.(null);
            }}
          />

          {required && !selected && <p className="help">Tipkaj min 2 slova za pretragu kupca.</p>}

          {loading && <div className="text-sm text-gray-500">Tražim…</div>}

          {!loading && items.length > 0 && (
            <div className="rounded-2xl bg-white shadow-sm divide-y">
              {items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left p-3 hover:bg-slate-50"
                  onClick={() => {
                    setSelected(c);
                    setQ(`${c.shortName ?? c.name} (${c.oib})`);
                    setItems([]);
                    onChange?.(c);
                  }}
                >
                  <div className="font-medium">{c.shortName ?? c.name}</div>
                  <div className="text-xs text-gray-500">
                    {c.oib} · {c.address}
                  </div>
                  {(c.contactPerson || c.phone) && (
                    <div className="text-xs text-gray-500">
                      {c.contactPerson ?? ""}
                      {c.contactPerson && c.phone ? " · " : ""}
                      {c.phone ?? ""}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {enableQuickCreate && !loading && q.trim().length >= 2 && items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-slate-700">Kupac nije pronađen.</p>
              <button
                type="button"
                className="mt-2 text-xs font-medium underline"
                onClick={() => {
                  setShowQuickCreate((v) => !v);
                  setQuickCreateError(null);
                  setQuickCreateSuccess(null);
                  setQuickForm((prev) => ({
                    ...prev,
                    oib: prev.oib || q.replace(/\D/g, "").slice(0, 11),
                    name: prev.name || q,
                  }));
                }}
              >
                {showQuickCreate ? "Zatvori brzo dodavanje" : "+ Dodaj novog kupca"}
              </button>
            </div>
          ) : null}

          {quickCreateSuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{quickCreateSuccess}</div>
          ) : null}

          {enableQuickCreate && showQuickCreate ? (
            <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2 flex gap-2">
                  <input
                    className="input text-sm"
                    placeholder="OIB*"
                    value={quickForm.oib}
                    onChange={(e) => updateQuickField("oib", e.target.value.replace(/\D/g, "").slice(0, 11))}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="btn btn-outline px-3 py-1 text-xs whitespace-nowrap"
                    onClick={handleQuickLookup}
                    disabled={quickLookupLoading}
                  >
                    {quickLookupLoading ? "Dohvaćam..." : "Dohvati OIB"}
                  </button>
                </div>
                <input
                  className="input text-sm"
                  placeholder="Naziv subjekta*"
                  value={quickForm.name}
                  onChange={(e) => updateQuickField("name", e.target.value)}
                />
                <input
                  className="input text-sm"
                  placeholder="Skraćeni naziv"
                  value={quickForm.shortName}
                  onChange={(e) => updateQuickField("shortName", e.target.value)}
                />
                <input
                  className="input text-sm"
                  placeholder="Ulica i broj*"
                  value={quickForm.street}
                  onChange={(e) => updateQuickField("street", e.target.value)}
                />
                <input
                  className="input text-sm"
                  placeholder="Poštanski broj"
                  value={quickForm.postalCode}
                  onChange={(e) => updateQuickField("postalCode", e.target.value)}
                />
                <input
                  className="input text-sm"
                  placeholder="Grad*"
                  value={quickForm.city}
                  onChange={(e) => updateQuickField("city", e.target.value)}
                />
                <input
                  className="input text-sm"
                  placeholder="Kontakt osoba"
                  value={quickForm.contactPerson}
                  onChange={(e) => updateQuickField("contactPerson", e.target.value)}
                />
                <input
                  className="input text-sm"
                  placeholder="Telefon"
                  value={quickForm.phone}
                  onChange={(e) => updateQuickField("phone", e.target.value)}
                />
                <input
                  className="input text-sm sm:col-span-2"
                  placeholder="Email"
                  value={quickForm.email}
                  onChange={(e) => updateQuickField("email", e.target.value)}
                />
              </div>

              {quickLookupError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">{quickLookupError}</div>
              ) : null}
              {quickLookupSuccess ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{quickLookupSuccess}</div>
              ) : null}

              {quickCreateError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">{quickCreateError}</div>
              ) : null}

              <div className="flex gap-2">
                <button type="button" className="btn btn-primary px-3 py-1 text-xs" onClick={handleQuickCreate} disabled={quickCreateLoading}>
                  {quickCreateLoading ? "Spremam..." : "Spremi kupca"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline px-3 py-1 text-xs"
                  onClick={() => {
                    setShowQuickCreate(false);
                    setQuickCreateError(null);
                  }}
                >
                  Odustani
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="font-medium">
              {selected.shortName ?? selected.name} ({selected.oib})
            </div>
            <span className="badge badge-tight badge-success whitespace-nowrap">✓ Odabrano</span>
          </div>
          <div className="text-gray-600">{hint}</div>
          <button
            type="button"
            className="mt-2 text-xs underline"
            onClick={() => {
              setSelected(null);
              setQ("");
              onChange?.(null);
            }}
          >
            Promijeni kupca
          </button>
        </div>
      )}
    </div>
  );
}
