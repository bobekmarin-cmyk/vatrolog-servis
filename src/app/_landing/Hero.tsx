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

      <div className="mx-auto grid max-w-[90rem] items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-[1.05fr_1.35fr] lg:gap-12">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-300/80 bg-white/80 px-3 py-1 text-xs font-semibold text-red-700 shadow-sm ring-1 ring-red-200/60 backdrop-blur">
            <IconFireExt className="h-3.5 w-3.5" />
            Aplikacija razvijena u suradnji sa serviserima vatrogasnih aparata
          </span>

          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem] lg:leading-[0.95] xl:text-6xl">
            <span className="block whitespace-nowrap">Digitalna evidencija</span>
            <span className="block whitespace-nowrap">
              servisa <span className="text-red-600">vatrogasnih</span>
            </span>
            <span className="block whitespace-nowrap">
              <span className="text-red-600">aparata</span>, bez papira
            </span>
            <span className="block whitespace-nowrap">i Excela.</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            VatroLog objedinjuje bazu podataka kupaca, servisne naloge, skladište dijelova, sva
            ovlaštenja i naljepnice za označavanje aparata, otpremnice i upisnike u jedan alat.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-red-600/25 ring-1 ring-red-500/40 transition hover:bg-red-500 hover:shadow-red-500/30"
            >
              Zatraži probni pristup
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#kako-radi"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-base font-semibold text-white shadow-sm ring-1 ring-slate-900 transition hover:bg-slate-800"
            >
              Pogledaj kako radi
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
            {[
              "30 dana probnog rada bez naplate",
              "Bez kartice i automatske naplate",
              "Zahtjev pregledavamo isti radni dan; uz dogovor dolazimo s prezentacijom programa uživo na vašu lokaciju",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative min-w-0">
          <div className="relative rounded-[1.75rem] bg-slate-950 p-2 shadow-2xl shadow-red-900/20 ring-1 ring-slate-900/80">
            <BrowserFrame url="vatrolog.com/work-orders">
              <HeroMock />
            </BrowserFrame>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-red-400/40 via-orange-300/20 to-transparent blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -left-10 -z-10 h-40 w-40 rounded-full bg-red-500/30 blur-3xl"
          />
        </div>
      </div>
    </section>
  );
}

function HeroMock() {
  const rows = [
    {
      id: "26-05-001",
      date: "13.05.2026.",
      customer: "Dječji vrtić Bubamara",
      location: "Radionica",
      progress: "10/10",
      progressPct: 100,
      status: "Zatvoren nalog",
      tone: "emerald",
    },
    {
      id: "26-05-002",
      date: "13.05.2026.",
      customer: "Hotel Adriatic",
      location: "Vozilo 1",
      progress: "4/7",
      progressPct: 57,
      status: "Servis u tijeku",
      tone: "red",
    },
    {
      id: "26-05-003",
      date: "12.05.2026.",
      customer: "OŠ Antuna Mihanovića",
      location: "Vozilo 2",
      progress: "22/22",
      progressPct: 100,
      status: "Zatvoren nalog",
      tone: "emerald",
    },
    {
      id: "26-05-004",
      date: "12.05.2026.",
      customer: "Dom zdravlja Split",
      location: "Radionica",
      progress: "9/18",
      progressPct: 50,
      status: "Servis u tijeku",
      tone: "red",
    },
    {
      id: "26-05-005",
      date: "11.05.2026.",
      customer: "HŠ Nastavni centar",
      location: "Vozilo 1",
      progress: "45/45",
      progressPct: 100,
      status: "Zatvoren nalog",
      tone: "emerald",
    },
  ] as const;

  const toneCls = {
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
  };

  const menuItems = [
    ["Dashboard"],
    ["Radni nalozi", "Skladište dijelova", "Skladište naljepnica"],
    ["Kupci", "Aparati"],
    ["Plan servisa", "Izvještaji"],
    ["Postavke"],
  ];

  return (
    <div className="grid grid-cols-12 gap-3 p-4 text-[9px] sm:text-[10px] xl:text-[11px]">
      <aside className="col-span-3 hidden rounded-xl bg-slate-900 p-3 text-slate-200 sm:block">
        <div className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Izbornik
        </div>
        <nav className="space-y-2">
          {menuItems.map((group) => (
            <ul
              key={group.join("-")}
              className="space-y-1 border-b border-white/10 pb-2 last:border-b-0 last:pb-0"
            >
              {group.map((item) => (
                <li
                  key={item}
                  className={`rounded-md px-2 py-1.5 ${
                    item === "Radni nalozi" ? "bg-white/10 text-white" : "text-slate-300"
                  }`}
                >
                  {item}
                </li>
              ))}
            </ul>
          ))}
        </nav>
      </aside>

      <div className="col-span-12 space-y-3 sm:col-span-9">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Otvoreni nalozi", value: "10" },
            { label: "Potrebno servisirati danas", value: "22" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg border border-slate-200 bg-white p-2.5"
            >
              <div className="text-[10px] text-slate-500">{kpi.label}</div>
              <div className="mt-0.5 text-lg font-bold text-slate-900">{kpi.value}</div>
            </div>
          ))}
          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="text-[10px] text-slate-500">Progres ovaj mjesec</div>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="text-lg font-bold text-slate-900">128/432</span>
              <span className="text-[10px] font-semibold text-indigo-600">30%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: "30%" }} />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-800">Radni nalozi</span>
            <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              + Novi nalog
            </span>
          </div>
          <div className="overflow-hidden bg-white">
            <div className="grid grid-cols-[0.8fr_0.8fr_1.45fr_0.9fr_1fr_1.15fr_0.6fr] bg-white text-[9px] uppercase tracking-wider text-slate-400">
              {["Nalog", "Datum", "Kupac", "Lokacija", "Napredak", "Status", "Akcija"].map(
                (header) => (
                  <div key={header} className="px-1.5 py-1.5 font-semibold">
                    {header}
                  </div>
                ),
              )}
            </div>
            <div className="divide-y divide-slate-200">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[0.8fr_0.8fr_1.45fr_0.9fr_1fr_1.15fr_0.6fr] items-center"
                >
                  <div className="px-1.5 py-2 font-semibold text-slate-900">{r.id}</div>
                  <div className="px-1.5 py-2 text-slate-500">{r.date}</div>
                  <div className="truncate px-1.5 py-2 text-slate-700">{r.customer}</div>
                  <div className="truncate px-1.5 py-2 text-slate-500">{r.location}</div>
                  <div className="px-1.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-indigo-600">{r.progress}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <span
                          className="block h-full rounded-full bg-indigo-500"
                          style={{ width: `${r.progressPct}%` }}
                        />
                      </span>
                    </div>
                  </div>
                  <div className="px-1.5 py-2">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold xl:text-[9px] ${toneCls[r.tone]}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="px-1.5 py-2">
                    <span className="font-semibold text-indigo-600">Otvori</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
