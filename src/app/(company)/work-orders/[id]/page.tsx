import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import DeleteItemForm from "@/components/DeleteItemForm";
import ConfirmLinkButton from "@/components/ConfirmLinkButton";
import { calcValidUntil, isStillValid } from "@/lib/validity";
import { formatExtinguisherTypeParts } from "@/lib/formatExtinguisherType";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import WorkOrderStatusBadge from "@/components/WorkOrderStatusBadge";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import WorkOrderDateForm from "@/components/WorkOrderDateForm";
import PlaceholderAddForm from "@/components/PlaceholderAddForm";
import ScanExtinguisherModal from "@/components/ScanExtinguisherModal";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import PdfActionButton from "@/components/PdfActionButton";
import { describeWorkOrderServiceContext } from "@/lib/workOrderDeliveryDisplay";
import PendingSubmitForm from "@/components/PendingSubmitForm";
import PendingNavigationLink from "@/components/PendingNavigationLink";

function fmtMonthYear(d: Date | null): string {
  if (!d) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${yyyy}`;
}

function fmtDotDate(d: Date | null | undefined): string {
  if (!d) return "";
  return formatDateDdMmYyyy(d);
}

function StatusBadge({
  serviced,
  placeholder,
  scrapped,
}: {
  serviced: boolean;
  placeholder: boolean;
  scrapped: boolean;
}) {
  if (scrapped) {
    return (
      <span className="badge badge-danger">Rashodovan</span>
    );
  }
  if (serviced) {
    return (
      <span className="badge badge-success">Servisirano</span>
    );
  }
  if (placeholder) {
    return <span className="badge badge-neutral">Placeholder</span>;
  }
  return (
    <span className="badge badge-warning">Nije servisirano</span>
  );
}

function ReviewBadges({ internalDone }: { internalDone: boolean }) {
  return (
    <div className="flex flex-nowrap items-center gap-2">
      <span
        className="badge badge-info font-semibold"
        title="PP = Periodični pregled"
      >
        PP
      </span>
      {internalDone && (
        <span
          className="badge badge-warning font-semibold"
          title="UP = Unutarnji pregled"
        >
          UP
        </span>
      )}
    </div>
  );
}

function ValidUntilBadge({
  date,
  titleOk,
  titleBad,
}: {
  date: Date | null;
  titleOk: string;
  titleBad: string;
}) {
  if (!date) return <span className="text-gray-400">-</span>;

  const ok = isStillValid(date);
  return (
    <span
      className={[
        "badge whitespace-nowrap",
        ok ? "badge-success" : "badge-danger",
      ].join(" ")}
      title={ok ? titleOk : titleBad}
    >
      {fmtMonthYear(date)}
    </span>
  );
}

export default async function ServiceViewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  if (!id) notFound();

  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      department: { select: { name: true } },
      serviceLocation: { select: { kind: true, label: true } },
      createdByAccountUser: { select: { username: true } },
      items: {
        orderBy: [{ isPlaceholder: "asc" }, { servicedAt: "asc" }, { createdAt: "asc" }],
        include: {
          servicer: true,
          extinguisher: { include: { manufacturer: true, type: { include: { agent: true, construction: true } } } },
        },
      },
    },
  });

  if (!order) notFound();

  const gmailStatus = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { gmailEmail: true },
  });
  const gmailConnected = !!gmailStatus?.gmailEmail;

  const total = order.items.length;
  const servicedCount = order.items.filter((i) => i.servicedAt).length;
  const isLocked = order.status === "LOCKED";
  const hasAnyServiced = order.items.some((i) => !!i.servicedAt || !!i.labelNumber);

  const remaining = Math.max(0, total - servicedCount);
  const pct = total > 0 ? Math.round((servicedCount / total) * 100) : 0;
  const allDone = total > 0 && servicedCount === total;

  return (
    <main className="space-y-6">
      {/* NASLOV + SVI GUMBI U JEDNOM REDU */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold leading-none">Servisni nalog</h1>
          <span className="text-lg leading-none text-slate-600 font-medium">{order.orderNumber}</span>
          <span className="text-sm leading-none text-slate-500">{fmtDotDate(order.receivedAt)}</span>
          <WorkOrderStatusBadge status={order.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn btn-outline px-4" href="/work-orders">
            ← Nalozi
          </Link>
          <PdfActionButton
            label="Primka"
            kind="primka"
            pdfUrl={`/work-orders/${order.id}/primka/pdf`}
            workOrderId={order.id}
            orderNumber={order.orderNumber}
            customerName={customerDisplayName(order.customer)}
            customerEmail={order.customer.email}
            gmailConnected={gmailConnected}
          />
          <PdfActionButton
            label="Upisnik"
            kind="register"
            pdfUrl={`/work-orders/${order.id}/register/pdf`}
            workOrderId={order.id}
            orderNumber={order.orderNumber}
            customerName={customerDisplayName(order.customer)}
            customerEmail={order.customer.email}
            gmailConnected={gmailConnected}
          />
          <PdfActionButton
            label="Otpremnica"
            kind="delivery-note"
            pdfUrl={`/work-orders/${order.id}/delivery-note/pdf`}
            workOrderId={order.id}
            orderNumber={order.orderNumber}
            customerName={customerDisplayName(order.customer)}
            customerEmail={order.customer.email}
            gmailConnected={gmailConnected}
          />
          {session.role === "ADMIN" && (
            <PendingNavigationLink
              className="btn btn-outline px-4"
              href={`/work-orders/${order.id}/report`}
              pendingTitle="Otvaram report..."
              pendingMessage="Molimo pričekajte, priprema se pregled radnog naloga."
            >
              Report
            </PendingNavigationLink>
          )}
          {!isLocked ? (
            <PendingSubmitForm
              action={`/api/work-orders/${order.id}/lock`}
              method="post"
              className="inline"
              pendingTitle="Zaključavam nalog..."
              pendingMessage="Molimo pričekajte, pripremaju se završni podaci naloga."
            >
              <button className="btn btn-primary px-4" type="submit">
                Zaključi nalog
              </button>
            </PendingSubmitForm>
          ) : (
            <PendingSubmitForm
              action={`/api/work-orders/${order.id}/unlock`}
              method="post"
              className="inline"
              pendingTitle="Otključavam nalog..."
              pendingMessage="Molimo pričekajte, nalog se priprema za izmjene."
            >
              <button className="btn btn-outline px-4 text-orange-700" type="submit">
                Otključaj
              </button>
            </PendingSubmitForm>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          <span className="font-medium text-slate-500">Lokacija:</span>{" "}
          {order.serviceLocation ? (
            <span className="inline-flex items-center gap-1">
              <span
                className={`badge badge-tight ${order.serviceLocation.kind === "STATIONARY" ? "badge-info" : "badge-success"}`}
              >
                {order.serviceLocation.kind === "STATIONARY" ? "S" : "V"}
              </span>
              {order.serviceLocation.label}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </span>
        <span>
          <span className="font-medium text-slate-500">Način servisa:</span>{" "}
          {describeWorkOrderServiceContext({
            deliveryMode: order.deliveryMode,
            serviceLocationKind: order.serviceLocation?.kind,
          })}
        </span>
        <span>
          <span className="font-medium text-slate-500">Kreirao:</span>{" "}
          {order.createdByAccountUser?.username ? (
            <span className="font-mono">{order.createdByAccountUser.username}</span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </span>
      </div>

      {/* INFO BLOKOVI */}
      <div className="grid gap-3 xl:grid-cols-4">
        <div className="rounded-xl border border-black/10 bg-slate-50 p-3 text-sm">
          <div className="text-base font-bold text-slate-900 clamp-2">{customerDisplayName(order.customer)}</div>
          <div className="mt-1 space-y-0.5 text-xs text-slate-600">
            {order.customer.address ? <div>{order.customer.address}</div> : null}
            {order.customer.email ? <div>{order.customer.email}</div> : null}
            {order.customer.phone ? <div>{order.customer.phone}</div> : null}
            {order.department?.name ? <div className="text-slate-500">{order.department.name}</div> : null}
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-slate-50 p-3 text-sm">
          <WorkOrderDateForm
            orderId={order.id}
            defaultValue={fmtDotDate(order.receivedAt)}
            disabled={isLocked || hasAnyServiced}
            disabledReason={
              hasAnyServiced
                ? "Datum je zaključan jer postoji servisiran aparat/naljepnica."
                : isLocked
                  ? "Nalog je zaključan."
                  : undefined
            }
          />
        </div>

        <div className="rounded-xl border border-black/10 bg-slate-50 p-3 text-sm">
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold tabular-nums ${allDone ? "text-emerald-600" : "text-indigo-700"}`}>
              {servicedCount}/{total}
            </span>
            <div className="flex-1">
              <div className="h-3 w-full rounded-full bg-slate-200">
                <div
                  className={`h-3 rounded-full transition-all ${allDone ? "bg-emerald-500" : "bg-indigo-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center">
            <div className="rounded-lg bg-white px-2 py-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Ukupno</div>
              <div className="text-lg font-bold tabular-nums text-slate-800">{total}</div>
            </div>
            <div className="rounded-lg bg-white px-2 py-1">
              <div className="text-[10px] text-emerald-600 uppercase tracking-wide">Servisirano</div>
              <div className="text-lg font-bold tabular-nums text-emerald-700">{servicedCount}</div>
            </div>
            <div className="rounded-lg bg-white px-2 py-1">
              <div className="text-[10px] text-amber-600 uppercase tracking-wide">Preostalo</div>
              <div className={`text-lg font-bold tabular-nums ${remaining > 0 ? "text-amber-700" : "text-slate-400"}`}>{remaining}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-slate-50 p-3 text-sm">
          {isLocked ? (
            <div className="text-xs text-gray-500">Nalog je zaključan — nije moguće dodavati ili brisati stavke.</div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <PlaceholderAddForm orderId={order.id} />
              <div className="h-px w-full bg-slate-200" />
              <ScanExtinguisherModal
                orderId={order.id}
                triggerLabel="Skeniraj QR kod"
                triggerClassName="btn btn-outline h-9 px-4 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* TABLICA */}
      <section className="surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold text-gray-600">
              <th className="p-3">Rb</th>
              <th className="p-3">Interni broj</th>
              <th className="p-3">Status</th>
              <th className="p-3">Proizvođač</th>
              <th className="p-3">Tip</th>
              <th className="p-3">Serijski + godina</th>
              <th className="p-3">Broj naljepnice</th>
              <th className="p-3">Pregledi</th>
              <th className="p-3">Vrijedi do</th>
              <th className="p-3">UP vrijedi do</th>
              <th className="p-3">Akcije</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {order.items.map((item, idx) => {
              const ex = item.extinguisher;

              const isServiced = !!item.servicedAt;
              const isPlaceholder = !!item.isPlaceholder;

              const anyEx: any = ex as any;
              const isScrapped = !!ex && (anyEx.status === "SCRAPPED" || !!anyEx.scrapReason || !!anyEx.scrappedAt);

              const internalCode = ex?.internalCode ?? "-";
              const manufacturer = ex ? displayManufacturer(ex.manufacturer) : "-";
              const typeParts = ex?.type ? formatExtinguisherTypeParts(ex.type) : null;
              const typeFallback = isPlaceholder ? "-" : "—";
              const typeDescription = ex?.typeDescription ?? "";

              const serial = ex?.serialNumber ?? "-";
              const year = ex?.productionYear ?? "-";
              const label = item.labelNumber ?? "-";

              const periodicValidUntil = item.nextPeriodicDue ?? (item.servicedAt ? calcValidUntil(item.servicedAt) : null);
              const internalDue = item.nextInternalDue ?? ex?.nextInternalDue ?? null;

              const canAct = !isLocked;

              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-3 text-gray-500">{idx + 1}</td>

                  <td className="p-3 font-mono text-xs">{internalCode}</td>

                  <td className="p-3">
                    <StatusBadge serviced={isServiced} placeholder={isPlaceholder} scrapped={isScrapped} />
                  </td>

                  <td className="p-3">{manufacturer}</td>
                  <td className="p-3">
                    {typeParts ? (
                      <>
                        <div className="font-medium text-slate-900">{typeParts.main}</div>
                        {typeParts.meta ? (
                          <div className="text-xs text-gray-500">{typeParts.meta}</div>
                        ) : null}
                      </>
                    ) : (
                      <div>{typeFallback}</div>
                    )}
                    {typeDescription ? <div className="text-xs text-gray-500">{typeDescription}</div> : null}
                  </td>

                  <td className="p-3">
                    <div className="font-mono text-xs">{serial}</div>
                    <div className="text-xs text-gray-500">{year}</div>
                  </td>

                  <td className="p-3 font-mono text-xs">{label}</td>

                  <td className="p-3">
                    <ReviewBadges internalDone={!!item.internalDone} />
                  </td>

                  <td className="p-3">
                    <ValidUntilBadge
                      date={periodicValidUntil}
                      titleOk="PP još vrijedi (kraj mjeseca datuma naloga + 1 godina)"
                      titleBad="Periodični je istekao"
                    />
                  </td>

                  <td className="p-3">
                    <ValidUntilBadge
                      date={internalDue}
                      titleOk="UP rok je u budućnosti"
                      titleBad="UP rok je istekao"
                    />
                  </td>

                  <td className="p-3">
                    {!canAct ? (
                      <span className="text-gray-400">Zaključano</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {item.isPlaceholder ? (
                          <Link
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50"
                            href={`/work-orders/${order.id}/items/${item.id}/fill`}
                            title="Popuni"
                            aria-label="Popuni"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="18"
                              height="18"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                          </Link>
                        ) : (
                          <>
                            <Link
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50"
                              href={`/work-orders/${order.id}/items/${item.id}/edit`}
                              title="Uredi podatke aparata"
                              aria-label="Uredi podatke aparata"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                              </svg>
                            </Link>
                            {isServiced ? (
                              <ConfirmLinkButton
                                href={`/work-orders/${order.id}/items/${item.id}/service`}
                                title="Otvori servis"
                                ariaLabel="Otvori servis"
                                confirmText="Aparat je već servisiran. Želiš li otvoriti servisni unos?"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="18"
                                  height="18"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M14.7 6.3a4 4 0 0 0-5.6 5.6L3 18l3 3 6.1-6.1a4 4 0 0 0 5.6-5.6l-2.2 2.2-2.8-2.8 2.0-2.5z" />
                                </svg>
                              </ConfirmLinkButton>
                            ) : (
                              <Link
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-green-700 hover:bg-green-50"
                                href={`/work-orders/${order.id}/items/${item.id}/service`}
                                title="Servisiraj"
                                aria-label="Servisiraj"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="18"
                                  height="18"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M14.7 6.3a4 4 0 0 0-5.6 5.6L3 18l3 3 6.1-6.1a4 4 0 0 0 5.6-5.6l-2.2 2.2-2.8-2.8 2.0-2.5z" />
                                </svg>
                              </Link>
                            )}
                          </>
                        )}

                        {session.role === "ADMIN" && (
                          <DeleteItemForm
                            action={`/api/work-orders/${order.id}/items/${item.id}/delete`}
                            disabled={false}
                            confirmText={
                              isServiced
                                ? "PAŽNJA: aparat je već servisiran! Jesi li siguran da želiš obrisati ovu stavku iz naloga?"
                                : item.isPlaceholder
                                  ? "Obrisati ovaj placeholder iz naloga?"
                                  : "Obrisati ovu stavku iz naloga?"
                            }
                          />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {order.items.length === 0 && (
              <tr>
                <td className="p-6 text-gray-500" colSpan={11}>
                  Nema stavki u nalogu.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-xs text-gray-500">
        Pravilo PP roka: datum radnog naloga 10.01.2026. → vrijedi do 01/2027 (kraj mjeseca + 1 godina).
      </p>
    </main>
  );
}

