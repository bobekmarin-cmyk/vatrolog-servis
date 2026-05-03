"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildAdminUsername,
  buildLocationLabel,
  buildLocationUsername,
  deriveUsernameSlug,
  isValidUsernameSlug,
  type LocationKind,
} from "@/lib/companyAccountNaming";

type LocationRow = { kind: LocationKind; ordinal: number; label: string };

function onlyDigits(s: string) {
  return s.replace(/\D+/g, "");
}

type FieldErrors = Partial<Record<
  | "companyName"
  | "oib"
  | "street"
  | "city"
  | "postalCode"
  | "iban"
  | "serviceCode"
  | "usernameSlug"
  | "adminEmail"
  | "locations",
  string
>>;

const FIELD_LABELS: Record<keyof FieldErrors, string> = {
  companyName: "Naziv subjekta",
  oib: "OIB / matični broj",
  street: "Ulica",
  city: "Grad",
  postalCode: "Poštanski broj",
  iban: "IBAN",
  serviceCode: "Šifra servisa",
  usernameSlug: "Username slug",
  adminEmail: "E-mail admina",
  locations: "Servisne lokacije",
};

export default function ApproveRequestForm({
  requestId,
  defaultCompanyName,
  defaultAdminEmail,
  defaultStreet,
  defaultCity,
  defaultPostalCode,
  defaultOib,
}: {
  requestId: string;
  defaultCompanyName: string;
  defaultAdminEmail: string;
  defaultStreet: string;
  defaultCity: string;
  defaultPostalCode: string;
  defaultOib: string;
}) {
  const router = useRouter();

  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [oib, setOib] = useState(defaultOib);
  const [street, setStreet] = useState(defaultStreet);
  const [city, setCity] = useState(defaultCity);
  const [postalCode, setPostalCode] = useState(defaultPostalCode);
  const [iban, setIban] = useState("");

  const [serviceCode, setServiceCode] = useState("");
  const [usernameSlug, setUsernameSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [adminEmail, setAdminEmail] = useState(defaultAdminEmail);
  const [stationaryCount, setStationaryCount] = useState(1);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [showLabelEdit, setShowLabelEdit] = useState(false);
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({});

  const [sendInvite, setSendInvite] = useState(true);
  const [approvalNote, setApprovalNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (slugTouched) return;
    const auto = deriveUsernameSlug(companyName);
    setUsernameSlug(auto ?? "");
  }, [companyName, slugTouched]);

  const normalizedCode = useMemo(() => onlyDigits(serviceCode).slice(0, 2), [serviceCode]);
  const validServiceCode = normalizedCode.length === 2;
  const validSlug = isValidUsernameSlug(usernameSlug);

  const locations: LocationRow[] = useMemo(() => {
    const rows: LocationRow[] = [];
    for (let i = 1; i <= stationaryCount; i++) {
      const key = `STATIONARY:${i}`;
      rows.push({
        kind: "STATIONARY",
        ordinal: i,
        label: labelOverrides[key] ?? buildLocationLabel("STATIONARY", i),
      });
    }
    for (let i = 1; i <= vehicleCount; i++) {
      const key = `VEHICLE:${i}`;
      rows.push({
        kind: "VEHICLE",
        ordinal: i,
        label: labelOverrides[key] ?? buildLocationLabel("VEHICLE", i),
      });
    }
    return rows;
  }, [stationaryCount, vehicleCount, labelOverrides]);

  const previewAdmin =
    validServiceCode && validSlug ? buildAdminUsername(normalizedCode, usernameSlug) : "";

  function previewLocationUsername(kind: LocationKind, ordinal: number): string {
    if (!validServiceCode || !validSlug) return "";
    return buildLocationUsername(normalizedCode, usernameSlug, kind, ordinal);
  }

  function setLabelOverride(kind: LocationKind, ordinal: number, value: string) {
    const key = `${kind}:${ordinal}`;
    setLabelOverrides((prev) => {
      const next = { ...prev };
      if (!value || value === buildLocationLabel(kind, ordinal)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!companyName.trim()) e.companyName = "Obavezno.";
    if (!/^\d{8,15}$/u.test(oib.trim())) e.oib = "8–15 znamenki.";
    if (!street.trim()) e.street = "Obavezno.";
    if (!city.trim()) e.city = "Obavezno.";
    if (!postalCode.trim()) e.postalCode = "Obavezno.";
    const ibanT = iban.trim();
    if (ibanT.length < 15) e.iban = "Unesi IBAN (≥ 15 znakova).";
    if (!validServiceCode) e.serviceCode = "Točno 2 znamenke (01–99).";
    if (!validSlug) e.usernameSlug = "2–15 znakova: a-z, 0-9.";
    if (!adminEmail.trim() || !adminEmail.includes("@"))
      e.adminEmail = "Neispravan e-mail.";
    if (stationaryCount + vehicleCount === 0)
      e.locations = "Mora postojati barem jedna lokacija.";
    return e;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) {
      setError(
        `Popuni obavezna polja: ${Object.keys(v)
          .map((k) => FIELD_LABELS[k as keyof FieldErrors])
          .join(", ")}.`,
      );
      const firstKey = Object.keys(v)[0];
      const el = document.querySelector<HTMLElement>(
        `[data-field="${firstKey}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setBusy(true);
    try {
      const payload = {
        companyName: companyName.trim(),
        oib: oib.trim(),
        street: street.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        iban: iban.trim(),
        serviceCode: normalizedCode,
        usernameSlug,
        adminEmail: adminEmail.trim(),
        stationaryCount,
        vehicleCount,
        locationLabels: locations.map((l) => ({
          kind: l.kind,
          ordinal: l.ordinal,
          label: l.label,
        })),
        sendInvite,
        approvalNote: approvalNote.trim() || null,
      };
      const res = await fetch(
        `/api/platform/registration-requests/${encodeURIComponent(requestId)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({} as { error?: string; fields?: FieldErrors }));
      if (!res.ok) {
        setError(data.error ?? "Odobravanje nije uspjelo.");
        if (data.fields) setErrors(data.fields);
        return;
      }
      setInfo(
        sendInvite
          ? "Tvrtka kreirana i pozivnica poslana na admin e-mail."
          : "Tvrtka kreirana. Pozivnicu možeš poslati ručno iz detalja tvrtke.",
      );
      router.refresh();
    } catch {
      setError("Greška u komunikaciji s poslužiteljem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormSection
        title="Tvrtka"
        description="Podaci kupca koji idu u Company zapis. OIB i adresu možeš ispraviti prije kreiranja."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Naziv subjekta" name="companyName" error={errors.companyName}>
            <input
              className={inputCls(errors.companyName)}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </Field>
          <Field label="OIB / matični broj" name="oib" error={errors.oib}>
            <input
              className={inputCls(errors.oib) + " font-mono"}
              value={oib}
              onChange={(e) => setOib(onlyDigits(e.target.value).slice(0, 15))}
              inputMode="numeric"
            />
          </Field>
          <Field label="Ulica" name="street" error={errors.street}>
            <input
              className={inputCls(errors.street)}
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
          </Field>
          <Field label="Grad" name="city" error={errors.city}>
            <input
              className={inputCls(errors.city)}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </Field>
          <Field label="Poštanski broj" name="postalCode" error={errors.postalCode}>
            <input
              className={inputCls(errors.postalCode)}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </Field>
          <Field
            label="IBAN"
            name="iban"
            error={errors.iban}
            hint="Format HR... — koristi se za fakturiranje."
          >
            <input
              className={inputCls(errors.iban) + " font-mono"}
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              placeholder="HR1210010051863000160"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Servisni identifikator i admin"
        description="Šifra servisa + slug grade username-e (XX-slug-adm, XX-slug-stN…). E-mail admina prima onboarding pozivnicu."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label="Šifra servisa (2 znamenke)"
            name="serviceCode"
            error={errors.serviceCode}
            hint="Npr. 01, 02, 13…"
          >
            <input
              className={inputCls(errors.serviceCode) + " font-mono"}
              value={serviceCode}
              onChange={(e) => setServiceCode(onlyDigits(e.target.value).slice(0, 2))}
              placeholder="01"
              inputMode="numeric"
              maxLength={2}
            />
          </Field>
          <Field
            label="Username slug"
            name="usernameSlug"
            error={errors.usernameSlug}
            hint="2–15 znakova (a-z, 0-9). Auto se izvodi iz naziva."
          >
            <input
              className={inputCls(errors.usernameSlug) + " font-mono"}
              value={usernameSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setUsernameSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "")
                    .slice(0, 15),
                );
              }}
              placeholder="vatrobr"
              maxLength={15}
            />
          </Field>
          <Field
            label="E-mail admina (za pozivnicu)"
            name="adminEmail"
            error={errors.adminEmail}
          >
            <input
              type="email"
              className={inputCls(errors.adminEmail)}
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Servisne lokacije"
        description="Stacionarni servis = u sjedištu. Vozilo = mobilni servis na lokaciji kupca. Za svaku lokaciju kreira se jedan WORKSHOP račun."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Stacionarne lokacije" name="locations" error={errors.locations}>
            <input
              type="number"
              className={inputCls(errors.locations)}
              min={0}
              max={5}
              value={stationaryCount}
              onChange={(e) =>
                setStationaryCount(Math.max(0, Math.min(5, Number(e.target.value) || 0)))
              }
            />
          </Field>
          <Field label="Servisna vozila">
            <input
              type="number"
              className="input"
              min={0}
              max={20}
              value={vehicleCount}
              onChange={(e) =>
                setVehicleCount(Math.max(0, Math.min(20, Number(e.target.value) || 0)))
              }
            />
          </Field>
        </div>

        {locations.length > 0 && (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              className="text-xs text-slate-700 underline"
              onClick={() => setShowLabelEdit((s) => !s)}
            >
              {showLabelEdit ? "Sakrij" : "Prepravi"} labele lokacija
            </button>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-[auto_1fr_auto] font-medium text-slate-600">
                <div>Tip</div>
                <div>Labela</div>
                <div>Username</div>
              </div>
              {locations.map((loc) => {
                const key = `${loc.kind}:${loc.ordinal}`;
                const username = previewLocationUsername(loc.kind, loc.ordinal);
                return (
                  <div
                    key={key}
                    className="grid grid-cols-1 gap-1 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  >
                    <span
                      className={`badge badge-tight ${
                        loc.kind === "STATIONARY" ? "badge-info" : "badge-success"
                      }`}
                    >
                      {loc.kind === "STATIONARY" ? "Stacionarni" : "Vozilo"}
                    </span>
                    {showLabelEdit ? (
                      <input
                        className="input text-xs"
                        value={loc.label}
                        onChange={(e) =>
                          setLabelOverride(loc.kind, loc.ordinal, e.target.value)
                        }
                        maxLength={60}
                      />
                    ) : (
                      <span className="text-slate-800">{loc.label}</span>
                    )}
                    <span className="font-mono text-slate-500">{username || "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </FormSection>

      <FormSection
        title="Pregled računa i pozivnica"
        description="Provjeri username-e koji će biti generirani. Onboarding pozivnica šalje admin link za postavljanje lozinki."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Planirani računi">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div className="font-mono">
                {previewAdmin || (
                  <span className="text-rose-600">XX-slug (popuni šifru i slug)</span>
                )}{" "}
                <span className="text-slate-400">(admin)</span>
              </div>
              {locations.length > 0 ? (
                locations.map((loc) => {
                  const key = `${loc.kind}:${loc.ordinal}`;
                  return (
                    <div key={key} className="font-mono">
                      {previewLocationUsername(loc.kind, loc.ordinal) || "—"}{" "}
                      <span className="text-slate-400">({loc.label})</span>
                    </div>
                  );
                })
              ) : (
                <div className="font-mono text-slate-400">Dodaj barem jednu lokaciju.</div>
              )}
            </div>
          </Field>
          <Field label="Interna bilješka (opcionalno)">
            <textarea
              className="input min-h-[96px]"
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              maxLength={500}
              placeholder="Npr. razlog odobrenja, dogovor, kontekst..."
            />
          </Field>
        </div>
        <label className="mt-3 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-900">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={sendInvite}
            onChange={(e) => setSendInvite(e.target.checked)}
          />
          <span>
            <span className="font-semibold">Odmah pošalji onboarding pozivnicu adminu</span>{" "}
            (preporučeno). Bez toga, tvrtka ostaje neaktivna dok ne pošalješ pozivnicu ručno
            iz detalja tvrtke.
          </span>
        </label>
      </FormSection>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {info}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          className="btn btn-primary px-5 disabled:opacity-60"
          type="submit"
          disabled={busy}
        >
          {busy ? "Odobravam…" : "Odobri i kreiraj tvrtku"}
        </button>
      </div>
    </form>
  );
}

function inputCls(err?: string): string {
  return err ? "input border-rose-400 ring-1 ring-rose-200 focus:ring-rose-300" : "input";
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div data-field={name}>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-rose-700">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
