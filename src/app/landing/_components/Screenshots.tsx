import BrowserFrame from "./BrowserFrame";

export default function Screenshots() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-600">
            Unutar alata
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Pogledaj kako VatroLog izgleda u stvarnom radu
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Ilustrativni prikaz ključnih ekrana. Prave snimke produkcijskog sučelja dodaju se
            prije javne kampanje.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <BrowserFrame url="app.vatrolog.hr/dashboard">
              <DashboardMock />
            </BrowserFrame>
            <p className="mt-3 text-center text-sm font-medium text-slate-700">
              Nadzorna ploča — rokovi, otvoreni nalozi i tjedni pregled
            </p>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <div>
              <BrowserFrame url="app.vatrolog.hr/work-orders/RN-2026-0142">
                <WorkOrderMock />
              </BrowserFrame>
              <p className="mt-3 text-center text-sm font-medium text-slate-700">
                Radni nalog — stavke, dijelovi i potpis
              </p>
            </div>
            <div>
              <BrowserFrame url="app.vatrolog.hr/extinguishers">
                <ExtinguishersMock />
              </BrowserFrame>
              <p className="mt-3 text-center text-sm font-medium text-slate-700">
                Evidencija aparata — status, rok i povijest
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMock() {
  const bars = [40, 68, 55, 82, 60, 72, 50];
  return (
    <div className="p-4 text-[11px] sm:text-xs">
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Otvoreni", value: "12", tone: "bg-indigo-50 text-indigo-700" },
          { label: "Rok < 30d", value: "47", tone: "bg-amber-50 text-amber-800" },
          { label: "Gotovi / mj.", value: "163", tone: "bg-emerald-50 text-emerald-700" },
          { label: "Kupci", value: "214", tone: "bg-slate-100 text-slate-700" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="text-[10px] text-slate-500">{k.label}</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-lg font-bold text-slate-900">{k.value}</span>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${k.tone}`}>
                +4%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800">Naloga po tjednu</span>
          <span className="text-[10px] text-slate-500">zadnjih 7 tjedana</span>
        </div>
        <div className="mt-3 flex h-24 items-end gap-2">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md bg-gradient-to-t from-red-500 to-orange-400"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkOrderMock() {
  return (
    <div className="space-y-3 p-3 text-[11px]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] text-slate-500">Radni nalog</div>
          <div className="text-base font-bold text-slate-900">RN-2026-0142</div>
        </div>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
          U servisu
        </span>
      </div>
      <div className="rounded-lg bg-slate-50 p-2">
        <div className="text-[10px] text-slate-500">Kupac</div>
        <div className="font-semibold text-slate-900">Vatrospas d.o.o.</div>
      </div>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
        {[
          { t: "S-6 prah ABC", s: "Periodični" },
          { t: "CO₂ 5 kg", s: "Internalni" },
          { t: "S-9 prah ABC", s: "Periodični" },
        ].map((r) => (
          <li key={r.t} className="flex items-center justify-between px-2 py-1.5">
            <span className="font-medium text-slate-800">{r.t}</span>
            <span className="text-[10px] text-slate-500">{r.s}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
          PDF upisnik
        </span>
        <span className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white">
          Zaključaj
        </span>
      </div>
    </div>
  );
}

function ExtinguishersMock() {
  return (
    <div className="p-3 text-[11px]">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex-1 rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-500 ring-1 ring-slate-200">
          Pretraži aparate…
        </div>
        <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">
          QR
        </span>
      </div>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
        {[
          { id: "APA-01042", type: "S-6 ABC", due: "U roku", tone: "bg-emerald-50 text-emerald-700" },
          { id: "APA-01043", type: "CO₂ 5 kg", due: "21 dan", tone: "bg-amber-50 text-amber-800" },
          { id: "APA-01044", type: "S-9 ABC", due: "Istekao", tone: "bg-rose-50 text-rose-700" },
        ].map((e) => (
          <li key={e.id} className="flex items-center justify-between px-2 py-1.5">
            <div>
              <div className="font-semibold text-slate-900">{e.id}</div>
              <div className="text-[10px] text-slate-500">{e.type}</div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.tone}`}>
              {e.due}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
