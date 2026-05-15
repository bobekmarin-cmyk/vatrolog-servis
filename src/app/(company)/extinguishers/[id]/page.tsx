import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { calcValidUntil, fmtDateHR, isStillValid } from "@/lib/validity";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import PrintPageButton from "@/components/PrintPageButton";

function StatusIcon({ isOk }: { isOk: boolean }) {
  return (
    <span
      className={[
        "inline-flex h-7 w-7 items-center justify-center rounded-full",
        isOk ? "bg-emerald-600 text-white" : "bg-rose-600 text-white",
      ].join(" ")}
      title={isOk ? "Ispravan" : "Rashodovan"}
      aria-label={isOk ? "Ispravan" : "Rashodovan"}
    >
      {isOk ? (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      )}
    </span>
  );
}

type InfoCardTone = "default" | "highlight" | "success" | "warning";

function InfoCard({
  label,
  children,
  mono,
  tone = "default",
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  tone?: InfoCardTone;
}) {
  const toneClass: Record<InfoCardTone, string> = {
    default: "border-slate-200 bg-slate-50/60",
    highlight: "border-indigo-200 bg-indigo-50/60",
    success: "border-emerald-200 bg-emerald-50",
    warning: "border-amber-300 bg-amber-50",
  };
  const labelToneClass: Record<InfoCardTone, string> = {
    default: "text-slate-500",
    highlight: "text-indigo-700",
    success: "text-emerald-700",
    warning: "text-amber-800",
  };
  const valueToneClass: Record<InfoCardTone, string> = {
    default: "text-slate-900",
    highlight: "text-slate-900",
    success: "text-emerald-900",
    warning: "text-amber-900",
  };
  return (
    <div className={["rounded-xl border p-3", toneClass[tone]].join(" ")}>
      <div
        className={[
          "text-[11px] font-semibold uppercase tracking-wide",
          labelToneClass[tone],
        ].join(" ")}
      >
        {label}
      </div>
      <div
        className={[
          "mt-1 text-base font-semibold",
          valueToneClass[tone],
          mono ? "font-mono" : "",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

function ValidUntilBadge({ date }: { date: Date | null }) {
  if (!date) return <span className="text-gray-400">-</span>;
  const ok = isStillValid(date);
  return (
    <span
      className={[
        "badge",
        ok ? "badge-success" : "badge-danger",
      ].join(" ")}
      title={ok ? "Periodični pregled još vrijedi" : "Periodični pregled je istekao"}
    >
      {fmtDateHR(date)}
    </span>
  );
}

export default async function ExtinguisherHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const extinguisher = await prisma.extinguisher.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      manufacturer: true,
      type: { include: { agent: true, construction: true } },
      workItems: {
        orderBy: [{ servicedAt: "desc" }, { createdAt: "desc" }],
        include: { workOrder: { include: { customer: true } } },
      },
    },
  });

  if (!extinguisher) notFound();

  const isScrapped =
    extinguisher.status === "SCRAPPED" || !!extinguisher.scrapReason || !!extinguisher.scrappedAt;
  const isOk = !isScrapped;

  const serviceHistory = extinguisher.workItems.filter((wi) => wi.servicedAt);

  const lastService = serviceHistory[0]?.servicedAt ?? null;
  const validUntil = extinguisher.nextPeriodicDue ?? (lastService ? calcValidUntil(lastService) : null);

  const ownershipChrono = [...serviceHistory]
    .sort((a, b) => (a.servicedAt!.getTime() ?? 0) - (b.servicedAt!.getTime() ?? 0))
    .map((wi) => ({
      date: wi.servicedAt!,
      customerId: wi.workOrder.customer.id,
      customerName: customerDisplayName(wi.workOrder.customer),
      orderId: wi.workOrder.id,
      orderNumber: wi.workOrder.orderNumber,
    }));

  const ownership = ownershipChrono.filter((x, idx, arr) => {
    if (idx === 0) return true;
    return arr[idx - 1].customerId !== x.customerId;
  });

  // Aktualni (zadnji) broj naljepnice iz povijesti servisa.
  const currentLabelNumber =
    serviceHistory.find((wi) => wi.labelNumber && wi.labelNumber.trim().length > 0)
      ?.labelNumber ?? null;

  const typeLabel = extinguisher.type ? formatExtinguisherTypeName(extinguisher.type) : "—";
  const scrapNote = (extinguisher.scrapReason ?? "").trim();

  const validityOk = !!validUntil && isStillValid(validUntil);
  const validityTone: InfoCardTone = validityOk ? "success" : "warning";

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">Aparat</h1>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-base font-semibold text-slate-700">
            {extinguisher.internalCode}
          </span>
          <StatusIcon isOk={isOk} />
          {!isOk && (
            <span className="badge badge-danger">
              Rashodovan{scrapNote ? ` — ${scrapNote}` : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PrintPageButton label="Ispiši stranicu" />
          <Link className="btn btn-outline px-4" href="/extinguishers">
            ← Aparati
          </Link>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCard label="Proizvođač / Tip" tone="highlight">
              {displayManufacturer(extinguisher.manufacturer)}
              {" / "}
              {typeLabel}
            </InfoCard>

            <InfoCard label="Serijski broj / Godina proizvodnje" mono tone="highlight">
              {extinguisher.serialNumber}/{extinguisher.productionYear}
            </InfoCard>

            <InfoCard
              label={validityOk ? "Naljepnica / Vrijedi do" : "Naljepnica / Servis istekao"}
              tone={validityTone}
            >
              <span className="font-mono">{currentLabelNumber ?? "—"}</span>
              <span className="px-1 text-slate-500"> / </span>
              {validUntil ? (
                <>
                  do <span className="font-mono">{fmtDateHR(validUntil)}</span>
                </>
              ) : (
                "—"
              )}
            </InfoCard>
          </div>
          {!validityOk && currentLabelNumber && (
            <p className="mt-3 text-xs text-amber-800">
              Servis je istekao. Prikazana naljepnica je ona postavljena na zadnjem servisu.
            </p>
          )}
        </div>

        <aside className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 lg:w-[260px]">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            QR naljepnica
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Image
              src={`/api/extinguishers/${extinguisher.id}/qr`}
              alt={`QR ${extinguisher.internalCode}`}
              width={88}
              height={88}
              className="rounded-md border border-slate-200"
              unoptimized
            />
            <div className="min-w-0">
              <div className="text-xs text-slate-500">Interni broj</div>
              <div className="font-mono text-base font-semibold text-slate-900">
                {extinguisher.internalCode}
              </div>
            </div>
          </div>
          <Link
            className="btn btn-outline mt-3 w-full justify-center px-3 py-1 text-xs"
            href={`/extinguishers/${extinguisher.id}/qr-label`}
            target="_blank"
            rel="noreferrer"
          >
            Otvori print naljepnice
          </Link>
        </aside>
      </section>

      {/* POVIJEST SERVISIRANJA */}
      <section className="surface">
        <div className="surface-header">
          <div>
            <h2 className="h1">Povijest servisiranja</h2>
            <p className="mt-1 subtle">PP vrijedi do se računa po pravilu: kraj mjeseca datuma naloga + 1 godina.</p>
          </div>
          <div className="subtle">Ukupno: {serviceHistory.length}</div>
        </div>
        <div className="h-px bg-black/10" />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-600">
                <th className="p-3">Datum servisa</th>
                <th className="p-3">Nalog</th>
                <th className="p-3">Kupac</th>
                <th className="p-3">Broj naljepnice</th>
                <th className="p-3">Vrsta pregleda</th>
                <th className="p-3">Vrijedi do</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {serviceHistory.map((wi) => {
                const vu = wi.nextPeriodicDue ?? (wi.servicedAt ? calcValidUntil(wi.servicedAt) : null);

                return (
                  <tr key={wi.id} className="hover:bg-gray-50">
                    <td className="p-3">{fmtDateHR(wi.servicedAt)}</td>

                    <td className="p-3">
                      <Link className="underline" href={`/work-orders/${wi.workOrder.id}`}>
                        {wi.workOrder.orderNumber}
                      </Link>
                    </td>

                    <td className="p-3">{customerDisplayName(wi.workOrder.customer)}</td>

                    <td className="p-3 font-mono text-xs">{wi.labelNumber ?? "-"}</td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="badge badge-info">Periodični</span>
                        {wi.internalDone && (
                          <span className="badge badge-warning">Unutarnji</span>
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      <ValidUntilBadge date={vu} />
                    </td>
                  </tr>
                );
              })}

              {serviceHistory.length === 0 && (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={6}>
                    Nema evidentiranih servisa za ovaj aparat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* POVIJEST VLASNIŠTVA */}
      <section className="surface">
        <div className="surface-header">
          <div>
            <h2 className="h1">Povijest vlasništva</h2>
            <p className="mt-1 subtle">
            Vlasništvo zaključujemo iz servisa (kupac na nalogu). Deduplicirano (isti kupac se ne ponavlja uzastopno).
          </p>
          </div>
          <div className="subtle">Ukupno: {ownership.length}</div>
        </div>
        <div className="h-px bg-black/10" />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-600">
                <th className="p-3">Od datuma</th>
                <th className="p-3">Vlasnik</th>
                <th className="p-3">Referenca (nalog)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {ownership.map((o, i) => (
                <tr key={`${o.customerId}-${o.date.toISOString()}-${i}`} className="hover:bg-gray-50">
                  <td className="p-3">{fmtDateHR(o.date)}</td>
                  <td className="p-3">{o.customerName}</td>
                  <td className="p-3">
                    <Link className="underline" href={`/work-orders/${o.orderId}`}>
                      {o.orderNumber}
                    </Link>
                  </td>
                </tr>
              ))}

              {ownership.length === 0 && (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={3}>
                    Nema dovoljno podataka za povijest vlasništva (nema servisa).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

