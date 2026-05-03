import Link from "next/link";
import BrowserFrame from "./BrowserFrame";
import { IconArrowRight, IconCheck, IconFireExt } from "./icons";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-red-50 via-orange-50/60 to-white"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[60rem] -translate-x-1/2 rounded-full bg-red-200/40 blur-3xl"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2 lg:gap-10">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white/70 px-3 py-1 text-xs font-semibold text-red-700 shadow-sm backdrop-blur">
            <IconFireExt className="h-3.5 w-3.5" />
            Za servisere vatrogasnih aparata u Hrvatskoj
          </span>

          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Digitalni servis{" "}
            <span className="text-red-600">vatrogasnih aparata</span>, bez papira i Excela.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            VatroLog objedinjuje servisne naloge, evidenciju aparata, skladište, upisnike i
            izvještaje u jedan alat. Od primitka aparata u radionicu do predaje kupcu s
            PDF-dostavnicom — sve u par klikova.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Zatraži probni pristup
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#kako-radi"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Pogledaj kako radi
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
            {[
              "14 dana probnog rada",
              "Bez kartice i automatske naplate",
              "Pregledamo zahtjev u 1 radnom danu",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <BrowserFrame url="app.vatrolog.hr/work-orders">
            <HeroMock />
          </BrowserFrame>
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-red-200/40 via-orange-200/30 to-transparent blur-2xl"
          />
        </div>
      </div>
    </section>
  );
}

function HeroMock() {
  const rows = [
    { id: "RN-2026-0142", customer: "Vatrospas d.o.o.", status: "U servisu", tone: "indigo" },
    { id: "RN-2026-0141", customer: "HŠ Nastavni centar", status: "Spremno", tone: "emerald" },
    { id: "RN-2026-0140", customer: "OŠ Antuna Mihanovića", status: "Na čekanju", tone: "amber" },
    { id: "RN-2026-0139", customer: "Dom zdravlja Split", status: "Dostavljeno", tone: "slate" },
  ] as const;

  const toneCls = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="grid grid-cols-12 gap-3 p-4 text-[11px] sm:text-xs">
      <aside className="col-span-3 hidden rounded-xl bg-slate-900 p-3 text-slate-200 sm:block">
        <div className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Izbornik
        </div>
        <ul className="space-y-1">
          {[
            "Nadzorna ploča",
            "Radni nalozi",
            "Aparati",
            "Kupci",
            "Skladište",
            "Izvještaji",
          ].map((item, i) => (
            <li
              key={item}
              className={`rounded-md px-2 py-1.5 ${
                i === 1 ? "bg-white/10 text-white" : "text-slate-300"
              }`}
            >
              {item}
            </li>
          ))}
        </ul>
      </aside>

      <div className="col-span-12 space-y-3 sm:col-span-9">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Otvoreni nalozi", value: "12" },
            { label: "Rokovi < 30d", value: "47" },
            { label: "Aparata u bazi", value: "1.284" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg border border-slate-200 bg-white p-2.5"
            >
              <div className="text-[10px] text-slate-500">{kpi.label}</div>
              <div className="mt-0.5 text-lg font-bold text-slate-900">{kpi.value}</div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-800">Radni nalozi</span>
            <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              + Novi nalog
            </span>
          </div>
          <ul className="divide-y divide-slate-200">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <div className="font-semibold text-slate-900">{r.id}</div>
                  <div className="text-slate-500">{r.customer}</div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneCls[r.tone]}`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
