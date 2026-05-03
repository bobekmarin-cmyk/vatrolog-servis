"use client";

import { useMemo, useState } from "react";

type Row = {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
};

export default function CustomerDepartmentsFields(props: { defaultRows?: Row[] }) {
  const { defaultRows } = props;
  const [rows, setRows] = useState<Row[]>(
    defaultRows && defaultRows.length > 0 ? defaultRows : [{ name: "", contactPerson: "", phone: "", email: "" }]
  );

  const hasAny = useMemo(() => rows.some((r) => r.name.trim().length > 0), [rows]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Odjeljenja</div>
          <div className="subtle">Opcionalno (npr. mehanizacija, vozni park, asfaltna baza).</div>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setRows((r) => [...r, { name: "", contactPerson: "", phone: "", email: "" }])}
        >
          + Dodaj odjel
        </button>
      </div>

      <div className="rounded-2xl bg-white shadow-sm">
        <div className="divide-y">
          {rows.map((r, idx) => (
            <div key={idx} className="p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-3">
                  <label className="label">Naziv</label>
                  <input
                    name="deptName"
                    className="input"
                    value={r.name}
                    onChange={(e) =>
                      setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder="npr. Vozni park"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="label">Kontakt osoba</label>
                  <input
                    name="deptContactPerson"
                    className="input"
                    value={r.contactPerson}
                    onChange={(e) =>
                      setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, contactPerson: e.target.value } : x)))
                    }
                    placeholder="npr. Ivan Ivić"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="label">Telefon</label>
                  <input
                    name="deptPhone"
                    className="input"
                    value={r.phone}
                    onChange={(e) =>
                      setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, phone: e.target.value } : x)))
                    }
                    placeholder="npr. 091 123 4567"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="label">Email</label>
                  <input
                    name="deptEmail"
                    type="email"
                    className="input"
                    value={r.email}
                    onChange={(e) =>
                      setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, email: e.target.value } : x)))
                    }
                    placeholder="npr. vozni.park@colas.hr"
                  />
                </div>

                <div className="md:col-span-12">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setRows((prev) =>
                        prev.length === 1
                          ? [{ name: "", contactPerson: "", phone: "", email: "" }]
                          : prev.filter((_, i) => i !== idx)
                      )
                    }
                    title="Ukloni red"
                  >
                    Ukloni
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!hasAny ? <div className="text-xs text-slate-500">Nema odjeljenja (možeš dodati kasnije u “Uredi”).</div> : null}
    </div>
  );
}

