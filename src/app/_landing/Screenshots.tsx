import MockupViewer from "./MockupViewer";

type InspectionMark = "PP" | "UP";

const serviceItems = [
  {
    rb: "1",
    internal: "01050001",
    manufacturer: "KLALEDA",
    type: "FX6",
    serial: "11141 / 2014",
    label: "171363167",
    status: "Servisirano",
    inspections: ["PP"] as InspectionMark[],
  },
  {
    rb: "2",
    internal: "01050002",
    manufacturer: "PASTOR",
    type: "S6",
    serial: "054214 / 2022",
    label: "171363168",
    status: "Servisirano",
    inspections: ["PP", "UP"] as InspectionMark[],
  },
  {
    rb: "3",
    internal: "01050003",
    manufacturer: "PASTOR",
    type: "P9+",
    serial: "066825 / 2018",
    label: "171363169",
    status: "Servisirano",
    inspections: ["PP"] as InspectionMark[],
  },
  {
    rb: "4",
    internal: "01050004",
    manufacturer: "GLORIA",
    type: "S6P",
    serial: "78442 / 2016",
    label: "171363170",
    status: "U tijeku",
    inspections: ["PP", "UP"] as InspectionMark[],
  },
  {
    rb: "5",
    internal: "01050005",
    manufacturer: "VATROMAX",
    type: "P1",
    serial: "99518 / 2019",
    label: "-",
    status: "Nije servisirano",
    inspections: ["PP"] as InspectionMark[],
  },
] as const;

export default function Screenshots() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(60rem 30rem at 20% 0%, rgba(220,38,38,0.24), transparent 60%), radial-gradient(50rem 28rem at 90% 100%, rgba(79,70,229,0.18), transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-[90rem] px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-300">
            Unutar alata
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Četiri ekrana koja servis koristi svaki dan
          </h2>
          <p className="mt-4 text-base text-slate-300">
            Servisni nalog, obrada aparata, otpremnica i upisnik povezani su u isti tijek
            rada — bez ponovnog prepisivanja podataka.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <MockupViewer
              url="vatrolog.com/work-orders/26-05-001"
              nativeWidth={1100}
              caption="Servisni nalog — 5 aparata, napredak i dokumenti"
            >
              <WorkOrderMock />
            </MockupViewer>
          </div>

          <div className="lg:col-span-2">
            <MockupViewer
              url="vatrolog.com/work-orders/26-05-001/service/01050003"
              nativeWidth={1100}
              caption="Servisiraj aparat — naljepnica, serviser, dijelovi i dodatne usluge"
            >
              <ServiceMock />
            </MockupViewer>
          </div>

          <div>
            <MockupViewer
              url="vatrolog.com/work-orders/26-05-001/otpremnica"
              nativeWidth={820}
              caption="Otpremnica — automatski dokument za predaju aparata kupcu"
            >
              <DeliveryNoteMock />
            </MockupViewer>
          </div>

          <div>
            <MockupViewer
              url="vatrolog.com/work-orders/26-05-001/upisnik"
              nativeWidth={820}
              caption="Upisnik — podaci o kupcu, serviseru i svim servisiranim aparatima"
            >
              <RegisterMock />
            </MockupViewer>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkOrderMock() {
  return (
    <div className="bg-slate-100 p-4 text-[10px] text-slate-700 sm:text-[11px]">
      <div className="mb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold text-slate-950">Servisni nalog</h3>
            <span className="font-semibold text-slate-500">26-05-001</span>
            <span className="text-slate-500">09.05.2026.</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Primka", "Upisnik", "Otpremnica", "Zaključi nalog"].map((action) => (
              <span
                key={action}
                className={`rounded-md px-2.5 py-1.5 font-semibold ${
                  action === "Zaključi nalog"
                    ? "bg-red-600 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
              >
                {action}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-white/70 px-3 py-1 text-[10px] text-slate-500 ring-1 ring-slate-200">
          Lokacija: Radionica · Način servisa: Dostavlja kupac · Kreirao: Moj Servis d.o.o.
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <InfoCard title="Kupac" value="Hotel Adriatic" note="Obala 12, Split" />
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">Napredak</span>
            <span className="text-sm font-bold text-indigo-600">3/5</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-[60%] rounded-full bg-indigo-600" />
          </div>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <div className="font-semibold text-slate-800">Dodaj aparat</div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-1">-</span>
            <span className="font-bold">1</span>
            <span className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white">Dodaj</span>
          </div>
          <div className="mt-2 rounded-md border border-slate-200 px-2 py-1 text-center">
            Skeniraj QR kod
          </div>
        </div>
      </div>

      <ExtinguisherTable />
    </div>
  );
}

function ServiceMock() {
  return (
    <div className="bg-slate-100 p-4 text-[10px] text-slate-700 sm:text-[11px]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold text-slate-950">Servisiraj aparat</h3>
            <span className="font-semibold text-slate-500">26-05-001</span>
            <span className="text-slate-500">Hotel Adriatic</span>
          </div>
        </div>
        <div className="rounded-xl bg-white px-10 py-2 text-center shadow-sm ring-1 ring-slate-200">
          <div className="text-xl font-extrabold text-slate-950">066825 / 2018</div>
          <div className="text-[10px] font-semibold text-slate-600">P9+ · PASTOR</div>
        </div>
      </div>

      <div className="grid grid-cols-[0.9fr_1.8fr] gap-3">
        <div className="space-y-3">
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <Label title="Broj naljepnice" value="171363169" />
            <div className="mt-3">
              <div className="mb-1 font-semibold text-slate-800">Serviser</div>
              <div className="grid grid-cols-3 gap-1.5">
                {["Ivan", "Luka", "Marko"].map((name) => (
                  <span
                    key={name}
                    className={`rounded-md px-2 py-1.5 text-center ${
                      name === "Marko"
                        ? "bg-red-50 font-semibold text-red-700 ring-1 ring-red-100"
                        : "bg-slate-100"
                    }`}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
            <Label title="Lokacija" value="Recepcija" className="mt-3" />
          </div>
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <div className="font-semibold text-slate-800">Unutarnji pregled (UP)</div>
            <div className="mt-2 rounded-lg bg-emerald-50 p-3 text-emerald-800 ring-1 ring-emerald-100">
              <div className="font-bold">UP ne treba ove godine</div>
              <div className="text-[10px]">Idući UP: 2028.</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-800">Rezervni dijelovi</div>
              <span className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white">Dodaj dio</span>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Šifra</th>
                    <th className="px-3 py-2">Naziv</th>
                    <th className="px-3 py-2">Količina</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {[
                    { code: "VT0400", name: "Brtva ventila", qty: "1 kom" },
                    { code: "SG0002", name: "Prah Furex ABC SPEC", qty: "6 kg" },
                  ].map((part) => (
                    <tr key={part.code}>
                      <td className="px-3 py-2 font-mono text-[10px] text-slate-700">
                        {part.code}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{part.name}</td>
                      <td className="px-3 py-2 text-slate-600">{part.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-800">Dodatne usluge</div>
              <span className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white">Dodaj uslugu</span>
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 p-2 text-slate-500">
              Nema odabranih dodatnih usluga.
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <span className="rounded-md bg-white px-3 py-2 font-semibold text-slate-700 ring-1 ring-slate-200">
              Odustani
            </span>
            <span className="rounded-md bg-red-600 px-3 py-2 font-semibold text-white">
              Spremi servis
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeliveryNoteMock() {
  return (
    <div className="bg-slate-100 p-4 text-[7px] text-slate-700 sm:text-[8px]">
      <div className="relative mx-auto aspect-[210/297] max-h-[58rem] overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="relative flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="text-sm font-extrabold text-slate-950">Moj Servis d.o.o.</div>
            <div className="mt-0.5 leading-snug text-slate-500">
              Ulica servisa 1, 10000 Zagreb · OIB: 00000000000<br />
              Tel: 097 612 3983 · Mail: info@mojservis.hr
            </div>
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-slate-950">
            Vatro<span className="text-red-600">Log</span>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-[1.05fr_0.95fr] gap-10">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.22em] text-slate-400">
              Kupac
            </div>
            <div className="mt-1 h-0.5 w-10 bg-red-600" />
            <div className="mt-3 text-lg font-extrabold text-slate-950">Hotel Adriatic</div>
            <div className="mt-2 leading-snug text-slate-700">
              OIB: 12345678901 · Obala 12, 21000 Split<br />
              Kontakt: Recepcija · +385911234567 · recepcija@adriatic.hr
            </div>
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-slate-950">Otpremnica</h3>
            <div className="mt-1 h-0.5 w-12 bg-red-600" />
            <dl className="mt-3 space-y-1">
              {[
                ["Broj naloga", "26-05-001"],
                ["Datum otpremnice", "13.05.2026."],
                ["Datum primitka na servis", "09.05.2026."],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-8">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-bold text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="relative mt-6">
          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-900">
            Izvršene usluge
          </h4>
          <div className="mt-1 overflow-hidden border-t border-slate-200">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 text-[7px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="w-[16%] px-1.5 py-1">Šifra</th>
                  <th className="px-1.5 py-1">Usluga</th>
                  <th className="w-[16%] px-1.5 py-1 text-right">Količina</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ["—", "Periodični pregled P6", "1 kom"],
                  ["—", "Periodični pregled P9", "1 kom"],
                  ["—", "Periodični pregled S6", "2 kom"],
                  ["—", "Periodični pregled P1", "1 kom"],
                ].map(([code, service, qty]) => (
                  <tr key={service}>
                    <td className="px-1.5 py-1 text-slate-400">{code}</td>
                    <td className="px-1.5 py-1 font-bold text-slate-950">{service}</td>
                    <td className="px-1.5 py-1 text-right">{qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="relative mt-4">
          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-900">
            Ugrađeni dijelovi
          </h4>
          <div className="mt-1 overflow-hidden border-t border-slate-200">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 text-[7px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="w-[18%] px-1.5 py-1">Šifra</th>
                  <th className="px-1.5 py-1">Naziv</th>
                  <th className="w-[18%] px-1.5 py-1 text-right">Količina</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ["VT0400", "Brtva ventila", "1 kom"],
                  ["ZT1500", "Brtva zatvarača", "1 kom"],
                  ["SM1240", "Membrana spojne cijevi", "1 kom"],
                  ["287090", "Brtva ventila", "1 kom"],
                  ["102801", "Brtva ventila", "1 kom"],
                ].map(([code, name, qty]) => (
                  <tr key={code}>
                    <td className="px-1.5 py-1 text-slate-400">{code}</td>
                    <td className="px-1.5 py-1 font-bold text-slate-950">{name}</td>
                    <td className="px-1.5 py-1 text-right">{qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="relative mt-4">
          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-900">
            Servisne naljepnice
          </h4>
          <div className="mt-1 overflow-hidden border-t border-slate-200">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 text-[7px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="w-[18%] px-1.5 py-1">Šifra</th>
                  <th className="px-1.5 py-1">Naziv</th>
                  <th className="w-[18%] px-1.5 py-1 text-right">Količina</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  "Naljepnica periodičnog pregleda PASTOR",
                  "Naljepnica periodičnog pregleda KLALEDA",
                  "Naljepnica periodičnog pregleda GLORIA",
                  "Naljepnica periodičnog pregleda VATROMAX",
                  "Naljepnica masa aparata PASTOR",
                  "Naljepnica masa aparata KLALEDA",
                  "Naljepnica masa aparata GLORIA",
                  "Naljepnica masa aparata VATROMAX",
                  "Naljepnica masa bočice PASTOR",
                ].map((name) => (
                  <tr key={name}>
                    <td className="px-1.5 py-0.5 text-slate-400">—</td>
                    <td className="px-1.5 py-0.5 font-bold text-slate-950">{name}</td>
                    <td className="px-1.5 py-0.5 text-right">1 kom</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="absolute bottom-16 right-8 w-44">
          <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
            Preuzeo kupac
          </div>
          <div className="mt-5 border-t border-slate-400 pt-1 text-center text-[7px] text-slate-400">
            Potpis i pečat
          </div>
        </div>

        <div className="absolute inset-x-5 bottom-4 flex items-end justify-between border-t border-slate-200 pt-1.5 text-[6px] text-slate-400">
          <div className="max-w-[70%] leading-relaxed">
            Lokacija: Radionica · Način servisa: Dostavlja kupac · Otpremnica prati
            servisirane vatrogasne aparate prilikom isporuke kupcu.
          </div>
          <div className="font-extrabold text-slate-950">
            Vatro<span className="text-red-600">Log</span>
          </div>
          <div>1 / 1</div>
        </div>
      </div>
    </div>
  );
}

function RegisterMock() {
  return (
    <div className="bg-slate-100 p-4 text-[7px] text-slate-700 sm:text-[8px]">
      <div className="relative mx-auto aspect-[210/297] max-h-[58rem] overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="relative flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="text-sm font-extrabold text-slate-950">Moj Servis d.o.o.</div>
            <div className="mt-0.5 leading-snug text-slate-500">
              Ulica servisa 1, 10000 Zagreb · OIB: 00000000000<br />
              Tel: 097 612 3983 · Mail: info@mojservis.hr
            </div>
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-slate-950">
            Vatro<span className="text-red-600">Log</span>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-[1.05fr_0.95fr] gap-10">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.22em] text-slate-400">
              Kupac
            </div>
            <div className="mt-1 h-0.5 w-10 bg-red-600" />
            <div className="mt-3 text-lg font-extrabold text-slate-950">Hotel Adriatic</div>
            <div className="mt-2 leading-snug text-slate-700">
              OIB: 12345678901 · Obala 12, 21000 Split<br />
              Kontakt: Recepcija · +385911234567 · recepcija@adriatic.hr
            </div>
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-slate-950">Upisnik</h3>
            <div className="mt-1 text-[7px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Evidencija izvršenog pregleda vatrogasnih aparata
            </div>
            <div className="mt-1 h-0.5 w-12 bg-red-600" />
            <dl className="mt-3 space-y-1">
              {[
                ["Broj naloga", "26-05-001"],
                ["Datum upisnika", "13.05.2026."],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-8">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-bold text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="relative mt-8 overflow-hidden border-t border-slate-200">
          <table className="w-full text-left text-[8px]">
            <thead className="border-b border-slate-200 text-[7px] uppercase tracking-wider text-slate-400">
              <tr>
                {[
                  "R.br.",
                  "Proizvođač",
                  "Tip",
                  "Punjenje",
                  "Serijski",
                  "God.",
                  "Unut.",
                  "Idući PP",
                  "Idući UP",
                  "Lokacija",
                  "Naljepnica",
                ].map((col) => (
                  <th key={col} className="px-1.5 py-1.5">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                {
                  item: serviceItems[0],
                  filling: "Prah",
                  pp: "05/2027",
                  up: "-",
                  location: "Recepcija",
                },
                {
                  item: serviceItems[1],
                  filling: "Prah",
                  pp: "05/2027",
                  up: "05/2030",
                  location: "Hodnik",
                },
                {
                  item: serviceItems[2],
                  filling: "Prah",
                  pp: "05/2027",
                  up: "-",
                  location: "Recepcija",
                },
                {
                  item: serviceItems[3],
                  filling: "Prah",
                  pp: "05/2027",
                  up: "05/2030",
                  location: "Kat",
                },
                {
                  item: serviceItems[4],
                  filling: "Prah",
                  pp: "05/2027",
                  up: "-",
                  location: "Kuhinja",
                },
              ].map(({ item, filling, pp, up, location }) => {
                const [serial, year] = item.serial.split(" / ");
                return (
                  <tr
                    key={item.internal}
                    className={item.inspections.includes("UP") ? "bg-sky-50/80" : undefined}
                  >
                    <td className="px-1.5 py-1.5">{item.rb}</td>
                    <td className="px-1.5 py-1.5">{item.manufacturer}</td>
                    <td className="px-1.5 py-1.5 font-bold text-slate-950">{item.type}</td>
                    <td className="px-1.5 py-1.5">{filling}</td>
                    <td className="px-1.5 py-1.5">{serial}</td>
                    <td className="px-1.5 py-1.5">{year}</td>
                    <td className="px-1.5 py-1.5">{item.inspections.includes("UP") ? "DA" : "NE"}</td>
                    <td className="px-1.5 py-1.5">{pp}</td>
                    <td className="px-1.5 py-1.5">{up}</td>
                    <td className="px-1.5 py-1.5">{location}</td>
                    <td className="px-1.5 py-1.5">{item.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="relative mt-3 text-[6px] text-slate-500">
          PP = periodični pregled · UP = unutarnji pregled · ST = stalni tlak · BO = bočica ·
          Svijetloplavi retci = na aparatu obavljen unutarnji pregled
        </div>

        <div className="absolute bottom-16 right-8 grid w-[28rem] grid-cols-2 gap-8">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
              Pripremio serviser
            </div>
            <div className="mt-5 border-t border-slate-400 pt-1 text-center text-[7px] text-slate-400">
              Potpis i pečat
            </div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
              Preuzeo kupac
            </div>
            <div className="mt-5 border-t border-slate-400 pt-1 text-center text-[7px] text-slate-400">
              Potpis i pečat
            </div>
          </div>
        </div>

        <div className="absolute inset-x-5 bottom-4 flex items-end justify-between border-t border-slate-200 pt-1.5 text-[6px] text-slate-400">
          <div className="max-w-[72%] leading-relaxed">
            Lokacija: Radionica · Način servisa: Dostavlja kupac · Servis i periodični
            pregled izvršeni su u skladu s pravilima struke.
          </div>
          <div className="font-extrabold text-slate-950">
            Vatro<span className="text-red-600">Log</span>
          </div>
          <div>1 / 1</div>
        </div>
      </div>
    </div>
  );
}

function ExtinguisherTable() {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full table-fixed text-left">
        <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="w-[7%] px-2 py-2">Rb</th>
            <th className="w-[14%] px-2 py-2">Interni broj</th>
            <th className="w-[15%] px-2 py-2">Status</th>
            <th className="w-[14%] px-2 py-2">Proizvođač</th>
            <th className="w-[10%] px-2 py-2">Tip</th>
            <th className="w-[18%] px-2 py-2">Serijski + godina</th>
            <th className="w-[14%] px-2 py-2">Naljepnica</th>
            <th className="w-[8%] px-2 py-2">Pregled</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {serviceItems.map((item) => (
            <tr key={item.internal}>
              <td className="px-2 py-2">{item.rb}</td>
              <td className="px-2 py-2 font-mono text-[10px]">{item.internal}</td>
              <td className="px-2 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                    item.status === "Servisirano"
                      ? "bg-emerald-50 text-emerald-700"
                      : item.status === "U tijeku"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {item.status}
                </span>
              </td>
              <td className="px-2 py-2">{item.manufacturer}</td>
              <td className="px-2 py-2 font-semibold text-slate-900">{item.type}</td>
              <td className="px-2 py-2">{item.serial}</td>
              <td className="px-2 py-2">{item.label}</td>
              <td className="px-2 py-2">
                <div className="flex gap-1">
                  {item.inspections.map((inspection) => (
                    <span
                      key={inspection}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        inspection === "UP"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {inspection}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <div className="text-[10px] text-slate-500">{title}</div>
      <div className="mt-1 font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-[10px] text-slate-500">{note}</div>
    </div>
  );
}

function Label({
  title,
  value,
  className = "",
}: {
  title: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1 font-semibold text-slate-800">{title}</div>
      <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">{value}</div>
    </div>
  );
}

function MiniPart({ title, qty }: { title: string; qty: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="font-semibold text-slate-800">{title}</span>
      <span className="text-slate-500">{qty}</span>
    </div>
  );
}

function PartCheckbox({ title, checked = false }: { title: string; checked?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold ${
          checked
            ? "border-red-600 bg-red-600 text-white"
            : "border-slate-300 bg-white text-transparent"
        }`}
      >
        ✓
      </span>
      <span className="font-semibold text-slate-800">{title}</span>
    </div>
  );
}
