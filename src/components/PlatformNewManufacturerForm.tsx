"use client";

import Link from "next/link";
import { useState } from "react";

export default function PlatformNewManufacturerForm() {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [oib, setOib] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  return (
    <form action="/api/platform/manufacturers/create" method="post" className="surface p-4 space-y-4">
      <div>
        <label className="label">Naziv proizvođača</label>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="npr. Klaleda d.o.o."
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Puni legalni naziv. Vidi se u platform admin sučelju.
        </p>
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
          Skraćeni naziv koji se prikazuje na otpremnicama, upisnicima, servisnim nalozima i ostalim
          dokumentima. Ako je prazno, koristi se puni naziv.
        </p>
      </div>
      <div>
        <label className="label">OIB (opcionalno)</label>
        <input
          name="oib"
          value={oib}
          onChange={(e) => setOib(e.target.value)}
          className="input"
          placeholder="npr. 12345678901"
        />
      </div>
      <div>
        <label className="label">Adresa (opcionalno)</label>
        <input
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="input"
          placeholder="Ulica, grad"
        />
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
      <div className="flex gap-2 pt-2">
        <button className="btn btn-primary px-4" type="submit">
          Spremi proizvođača
        </button>
        <Link className="btn btn-outline px-4" href="/platform/manufacturers">
          Odustani
        </Link>
      </div>
    </form>
  );
}
