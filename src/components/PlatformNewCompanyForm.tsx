"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildAdminUsername,
  buildLocationLabel,
  buildLocationUsername,
  deriveUsernameSlug,
  isValidUsernameSlug,
  type LocationKind,
} from "@/lib/companyAccountNaming";

function onlyDigits(s: string) {
  return s.replace(/\D+/g, "");
}

type LocationRow = { kind: LocationKind; ordinal: number; label: string };

export default function PlatformNewCompanyForm() {
  const [name, setName] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [usernameSlug, setUsernameSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [oib, setOib] = useState("");
  const [stationaryCount, setStationaryCount] = useState(1);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [showLabelEdit, setShowLabelEdit] = useState(false);
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({});
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");

  const streetRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const postalRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (slugTouched) return;
    const auto = deriveUsernameSlug(name);
    queueMicrotask(() => setUsernameSlug(auto ?? ""));
  }, [name, slugTouched]);

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

  function previewUsername(kind: LocationKind, ordinal: number): string {
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

  async function handleOibLookup() {
    const cleaned = oib.replace(/\D/g, "");
    if (cleaned.length !== 11) {
      setLookupMsg("OIB mora imati točno 11 znamenki.");
      return;
    }
    setLookupBusy(true);
    setLookupMsg("");
    try {
      const res = await fetch("/api/platform/oib-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oib: cleaned }),
      });
      const json = await res.json();
      if (json.found && json.data) {
        const d = json.data as { name: string; street: string; city: string; postalCode: string };
        setName(d.name);
        if (streetRef.current) streetRef.current.value = d.street;
        if (cityRef.current) cityRef.current.value = d.city;
        if (postalRef.current) postalRef.current.value = d.postalCode;
        setLookupMsg("Podaci popunjeni iz registra.");
      } else {
        setLookupMsg(json.message || json.error || "Nije pronađeno.");
      }
    } catch {
      setLookupMsg("Greška pri dohvatu.");
    }
    setLookupBusy(false);
  }

  const totalLocations = stationaryCount + vehicleCount;
  const canSubmit = validServiceCode && validSlug && totalLocations > 0;

  return (
    <form className="surface p-4 space-y-4" action="/api/platform/companies/create" method="post">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Naziv</label>
          <input
            name="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">OIB</label>
          <div className="flex gap-2">
            <input
              name="oib"
              className="input flex-1 font-mono"
              required
              maxLength={11}
              inputMode="numeric"
              value={oib}
              onChange={(e) => setOib(onlyDigits(e.target.value).slice(0, 11))}
            />
            <button
              type="button"
              className="btn btn-outline px-3 text-xs shrink-0"
              disabled={lookupBusy}
              onClick={handleOibLookup}
            >
              {lookupBusy ? "..." : "Pretraži"}
            </button>
          </div>
          {lookupMsg && (
            <p className={`mt-1 text-xs ${lookupMsg.includes("popunjeni") ? "text-emerald-600" : "text-amber-600"}`}>
              {lookupMsg}
            </p>
          )}
        </div>

        <div>
          <label className="label">Šifra servisa</label>
          <input
            name="serviceCode"
            value={serviceCode}
            onChange={(e) => setServiceCode(onlyDigits(e.target.value).slice(0, 2))}
            className="input font-mono"
            placeholder="npr. 01"
            inputMode="numeric"
            pattern="\d{2}"
            maxLength={2}
            required
          />
          <p className="help">Dvoznamenkasti broj (01–99). Prefiks svih korisničkih računa.</p>
        </div>
        <div>
          <label className="label">Slug username-a</label>
          <input
            name="usernameSlug"
            value={usernameSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setUsernameSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15));
            }}
            className="input font-mono"
            placeholder="npr. vatrobr"
            pattern="[a-z0-9]{2,15}"
            minLength={2}
            maxLength={15}
            required
          />
          <p className="help">
            Slova/brojevi (2–15). Auto-izvodi se iz naziva (prvih 7 znakova). Mijenja sva korisnička imena.
          </p>
        </div>

        <div>
          <label className="label">Ulica</label>
          <input ref={streetRef} name="street" className="input" required />
        </div>
        <div>
          <label className="label">Grad</label>
          <input ref={cityRef} name="city" className="input" required />
        </div>
        <div>
          <label className="label">Poštanski broj</label>
          <input ref={postalRef} name="postalCode" className="input" required />
        </div>
        <div>
          <label className="label">IBAN</label>
          <input name="iban" className="input" required />
        </div>
      </div>

      <div className="h-px bg-black/10" />

      <div>
        <h3 className="text-sm font-semibold mb-2">Servisne lokacije</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Stacionarne lokacije</label>
            <input
              name="stationaryCount"
              type="number"
              className="input"
              min={0}
              max={5}
              value={stationaryCount}
              onChange={(e) =>
                setStationaryCount(Math.max(0, Math.min(5, Number(e.target.value) || 0)))
              }
            />
            <p className="help">Servis u sjedištu tvrtke (najčešće 1).</p>
          </div>
          <div>
            <label className="label">Servisna vozila</label>
            <input
              name="vehicleCount"
              type="number"
              className="input"
              min={0}
              max={20}
              value={vehicleCount}
              onChange={(e) =>
                setVehicleCount(Math.max(0, Math.min(20, Number(e.target.value) || 0)))
              }
            />
            <p className="help">Mobilni servis u vozilima na lokaciji kupca.</p>
          </div>
        </div>

        {totalLocations === 0 && (
          <p className="mt-2 text-xs text-rose-600">
            Mora postojati barem jedna lokacija (stacionarna ili vozilo).
          </p>
        )}

        {totalLocations > 0 && (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              className="text-xs underline text-slate-700"
              onClick={() => setShowLabelEdit((s) => !s)}
            >
              {showLabelEdit ? "Sakrij" : "Prepravi"} labele lokacija
            </button>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-[auto_1fr_auto]">
                <div className="font-medium text-slate-600">Tip</div>
                <div className="font-medium text-slate-600">Labela</div>
                <div className="font-medium text-slate-600">Username</div>
              </div>
              {locations.map((loc) => {
                const key = `${loc.kind}:${loc.ordinal}`;
                const username = previewUsername(loc.kind, loc.ordinal);
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
                        name={`locationLabel:${loc.kind}:${loc.ordinal}`}
                        className="input input-sm text-xs"
                        value={loc.label}
                        onChange={(e) => setLabelOverride(loc.kind, loc.ordinal, e.target.value)}
                        maxLength={60}
                      />
                    ) : (
                      <>
                        <span className="text-slate-800">{loc.label}</span>
                        <input
                          type="hidden"
                          name={`locationLabel:${loc.kind}:${loc.ordinal}`}
                          value={loc.label}
                        />
                      </>
                    )}
                    <span className="font-mono text-slate-500">{username || "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="h-px bg-black/10" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Email admin kontakta (za pozivnice)</label>
          <input name="accountEmail" type="email" className="input" placeholder="admin@tvrtka.hr" />
          <p className="help">Na ovu adresu će ići linkovi za aktivaciju računa.</p>
        </div>
        <div>
          <label className="label">Planirani računi</label>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
            <div className="font-mono">{previewAdmin || "XX-slug"} <span className="text-slate-400">(admin)</span></div>
            {locations.length > 0 ? (
              locations.map((loc) => {
                const key = `${loc.kind}:${loc.ordinal}`;
                return (
                  <div key={key} className="font-mono">
                    {previewUsername(loc.kind, loc.ordinal) || "—"}{" "}
                    <span className="text-slate-400">({loc.label})</span>
                  </div>
                );
              })
            ) : (
              <div className="font-mono text-slate-400">Dodaj barem jednu lokaciju.</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button className="btn btn-primary px-4" type="submit" disabled={!canSubmit}>
          Kreiraj tvrtku
        </button>
        <Link className="btn btn-outline px-4" href="/platform/companies">
          Odustani
        </Link>
      </div>
    </form>
  );
}
