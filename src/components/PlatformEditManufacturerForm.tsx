"use client";

import Link from "next/link";
import { useState } from "react";

export default function PlatformEditManufacturerForm(props: {
  action: string;
  initial: {
    name: string;
    displayName: string | null;
    oib: string | null;
    address: string | null;
    contactPerson: string | null;
    contactEmail: string | null;
  };
}) {
  const [name, setName] = useState(props.initial.name);
  const [displayName, setDisplayName] = useState(props.initial.displayName ?? "");
  const [oib, setOib] = useState(props.initial.oib ?? "");
  const [address, setAddress] = useState(props.initial.address ?? "");
  const [contactPerson, setContactPerson] = useState(props.initial.contactPerson ?? "");
  const [contactEmail, setContactEmail] = useState(props.initial.contactEmail ?? "");

  return (
    <form action={props.action} method="post" className="surface p-4 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Osnovni podaci</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Naziv proizvođača</label>
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              required
            />
            <p className="mt-1 text-xs text-slate-500">Puni legalni naziv. Vidljiv samo u platform adminu.</p>
          </div>
          <div>
            <label className="label">Prikaz na dokumentima (opcionalno)</label>
            <input
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
              placeholder="npr. KLALEDA"
            />
            <p className="mt-1 text-xs text-slate-500">
              Skraćeni naziv na otpremnicama, upisnicima, servisnim nalozima i ostalim dokumentima. Prazno = puni naziv.
            </p>
          </div>
          <div>
            <label className="label">OIB (opcionalno)</label>
            <input name="oib" value={oib} onChange={(e) => setOib(e.target.value)} className="input font-mono" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Adresa (opcionalno)</label>
            <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Kontakt osoba (opcionalno)</label>
            <input
              name="contactPerson"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Kontakt email (opcionalno)</label>
            <input
              name="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Pravila unutarnjeg pregleda (UP) definiraju se po <strong>tipu aparata</strong> u kartici „Aparati“.
      </div>

      <div className="flex gap-2 pt-2">
        <button className="btn btn-primary px-4" type="submit">
          Spremi
        </button>
        <Link className="btn btn-outline px-4" href="/platform/manufacturers">
          ← Proizvođači
        </Link>
      </div>
    </form>
  );
}
