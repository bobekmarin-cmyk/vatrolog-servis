import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { describeWorkOrderServiceContext } from "@/lib/workOrderDeliveryDisplay";

function fmtTs(d: Date | null | undefined): string {
  if (!d) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy}. ${hh}:${min}:${ss}`;
}

type TimelineEntry = {
  ts: Date;
  icon: string;
  color: string;
  text: string;
  detail?: string;
};

export default async function WorkOrderReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/work-orders");

  const { id } = await params;

  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      receivedAt: true,
      dueAt: true,
      receivedQty: true,
      note: true,
      deliveryMode: true,
      startedAt: true,
      finishedAt: true,
      lockedAt: true,
      createdAt: true,
      updatedAt: true,
      customer: { select: { shortName: true, name: true, oib: true, address: true } },
      department: { select: { name: true } },
      serviceLocation: { select: { kind: true, label: true } },
      createdByAccountUser: { select: { username: true } },
      lockedBy: { select: { fullName: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          isPlaceholder: true,
          createdAt: true,
          updatedAt: true,
          servicedAt: true,
          labelNumber: true,
          internalDone: true,
          internalDoneAt: true,
          nextPeriodicDue: true,
          nextInternalDue: true,
          serviceLocationText: true,
          partsText: true,
          serviceNote: true,
          servicer: { select: { fullName: true } },
          extinguisher: {
            select: {
              internalCode: true,
              serialNumber: true,
              productionYear: true,
              status: true,
              scrapReason: true,
              scrappedAt: true,
              manufacturer: { select: { name: true, displayName: true } },
              type: {
                select: {
                  name: true,
                  code: true,
                  agent: { select: { code: true, label: true, symbol: true } },
                  construction: { select: { code: true, label: true } },
                },
              },
            },
          },
          parts: {
            select: {
              snapshotCode: true,
              snapshotName: true,
              part: { select: { name: true, code: true } },
            },
          },
        },
      },
      documentLogs: {
        orderBy: { createdAt: "asc" },
        select: { docType: true, createdAt: true },
      },
    },
  });

  if (!order) notFound();

  const timeline: TimelineEntry[] = [];

  timeline.push({
    ts: order.createdAt,
    icon: "📋",
    color: "border-indigo-400",
    text: `Radni nalog ${order.orderNumber} kreiran`,
    detail: `Kupac: ${customerDisplayName(order.customer)}${order.department?.name ? ` · Odjeljenje: ${order.department.name}` : ""}${order.receivedAt ? ` · Datum naloga: ${formatDateDdMmYyyy(order.receivedAt)}` : ""}${order.note ? ` · Napomena: ${order.note}` : ""}`,
  });

  timeline.push({
    ts: order.createdAt,
    icon: "📥",
    color: "border-blue-400",
    text: `Primitak: ${order.receivedQty} kom`,
    detail: `Način servisa: ${describeWorkOrderServiceContext({
      deliveryMode: order.deliveryMode,
      serviceLocationKind: order.serviceLocation?.kind,
    })} · Datum primitka: ${formatDateDdMmYyyy(order.receivedAt)}${order.dueAt ? ` · Željeni završetak: ${formatDateDdMmYyyy(order.dueAt)}` : ""}${order.note ? ` · Napomena: ${order.note}` : ""}`,
  });

  if (order.startedAt) {
    timeline.push({
      ts: order.startedAt,
      icon: "🔧",
      color: "border-yellow-400",
      text: "Nalog stavljen u rad",
    });
  }

  const placeholders = order.items.filter((i) => i.isPlaceholder);
  const filledItems = order.items.filter((i) => !i.isPlaceholder);

  const placeholdersByMinute = new Map<string, typeof placeholders>();
  for (const p of placeholders) {
    const key = `${p.createdAt.getFullYear()}-${p.createdAt.getMonth()}-${p.createdAt.getDate()}-${p.createdAt.getHours()}-${p.createdAt.getMinutes()}`;
    const arr = placeholdersByMinute.get(key) ?? [];
    arr.push(p);
    placeholdersByMinute.set(key, arr);
  }
  for (const [, group] of placeholdersByMinute) {
    timeline.push({
      ts: group[0].createdAt,
      icon: "➕",
      color: "border-slate-300",
      text: `${group.length} placeholder stavk${group.length === 1 ? "a dodana" : "e dodano"}`,
    });
  }

  for (const item of filledItems) {
    const ex = item.extinguisher;
    const exLabel = ex
      ? `${ex.internalCode} · ${displayManufacturer(ex.manufacturer)} · ${ex.type ? formatExtinguisherTypeName(ex.type) : "?"} · S/N ${ex.serialNumber} · God. ${ex.productionYear}`
      : "Nepoznat aparat";

    timeline.push({
      ts: item.createdAt,
      icon: "🔖",
      color: "border-blue-300",
      text: `Stavka popunjena: ${ex?.internalCode ?? "?"}`,
      detail: exLabel,
    });

    if (item.servicedAt) {
      const partsList = item.parts
        .map((p) => `${p.snapshotCode ?? p.part.code} ${p.snapshotName ?? p.part.name}`)
        .join(", ");

      const details: string[] = [];
      if (item.servicer) details.push(`Serviser: ${item.servicer.fullName}`);
      if (item.labelNumber) details.push(`Naljepnica: ${item.labelNumber}`);
      details.push(`Periodični: DA`);
      details.push(`Unutarnji: ${item.internalDone ? "DA" : "NE"}`);
      if (item.nextPeriodicDue) details.push(`PP vrijedi do: ${formatDateDdMmYyyy(item.nextPeriodicDue)}`);
      if (item.nextInternalDue) details.push(`UP vrijedi do: ${formatDateDdMmYyyy(item.nextInternalDue)}`);
      if (item.serviceLocationText) details.push(`Lokacija: ${item.serviceLocationText}`);
      if (partsList) details.push(`Dijelovi: ${partsList}`);
      if (item.partsText) details.push(`Dijelovi (tekst): ${item.partsText}`);
      if (item.serviceNote) details.push(`Napomena servisa: ${item.serviceNote}`);

      timeline.push({
        ts: item.servicedAt,
        icon: "✅",
        color: "border-emerald-400",
        text: `Servisiran: ${ex?.internalCode ?? "?"}`,
        detail: details.join(" · "),
      });
    }

    if (item.updatedAt.getTime() - item.createdAt.getTime() > 2000 && (!item.servicedAt || item.updatedAt.getTime() > item.servicedAt.getTime() + 2000)) {
      timeline.push({
        ts: item.updatedAt,
        icon: "✏️",
        color: "border-orange-300",
        text: `Stavka ažurirana: ${ex?.internalCode ?? "?"}`,
      });
    }
  }

  const deletedCount = (order.receivedQty ?? 0) - order.items.length;
  if (deletedCount > 0) {
    timeline.push({
      ts: order.updatedAt,
      icon: "🗑️",
      color: "border-red-300",
      text: `Primljeno ${order.receivedQty} aparata, u nalogu ${order.items.length} stavki — razlika ${deletedCount} (moguće obrisane stavke)`,
    });
  }

  if (order.lockedAt) {
    timeline.push({
      ts: order.lockedAt,
      icon: "🔒",
      color: "border-purple-400",
      text: `Nalog zaključan`,
      detail: order.lockedBy ? `Zaključao: ${order.lockedBy.fullName}` : undefined,
    });
  }

  if (order.finishedAt) {
    timeline.push({
      ts: order.finishedAt,
      icon: "🏁",
      color: "border-green-500",
      text: "Nalog označen kao završen",
    });
  }

  const docTypeLabels: Record<string, { icon: string; color: string; label: string }> = {
    DELIVERY_NOTE_PDF: { icon: "🚚", color: "border-teal-400", label: "Otpremnica (PDF) generirana" },
    REGISTER_PDF: { icon: "📄", color: "border-violet-400", label: "Upisnik (PDF) generiran" },
    REGISTER_VIEW: { icon: "👁️", color: "border-violet-300", label: "Upisnik (pregled) otvoren" },
  };

  for (const log of order.documentLogs) {
    const meta = docTypeLabels[log.docType] ?? { icon: "📎", color: "border-slate-300", label: log.docType };
    timeline.push({
      ts: log.createdAt,
      icon: meta.icon,
      color: meta.color,
      text: meta.label,
    });
  }

  timeline.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const servicedItems = filledItems.filter((i) => i.servicedAt);
  const unservicedItems = filledItems.filter((i) => !i.servicedAt);

  const scrapItems = filledItems.filter((i) => {
    const e = i.extinguisher;
    return e && (e.status === "SCRAPPED" || e.scrapReason || e.scrappedAt);
  });

  return (
    <main className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Report: {order.orderNumber}</h1>
        <Link className="btn btn-outline px-4" href={`/work-orders/${order.id}`}>
          ← Nalog
        </Link>
      </div>

      {/* SAŽETAK */}
      <section className="surface p-4 space-y-2 text-sm">
        <h2 className="text-lg font-semibold">Sažetak</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div><span className="text-slate-500">Nalog:</span> <b>{order.orderNumber}</b></div>
          <div><span className="text-slate-500">Status:</span> <b>{order.status}</b></div>
          <div><span className="text-slate-500">Kupac:</span> <b>{customerDisplayName(order.customer)}</b></div>
          <div><span className="text-slate-500">OIB:</span> {order.customer.oib}</div>
          {order.customer.address && <div><span className="text-slate-500">Adresa:</span> {order.customer.address}</div>}
          {order.department?.name && <div><span className="text-slate-500">Odjeljenje:</span> {order.department.name}</div>}
          {order.receivedAt && <div><span className="text-slate-500">Datum naloga:</span> {formatDateDdMmYyyy(order.receivedAt)}</div>}
          {order.dueAt && <div><span className="text-slate-500">Rok:</span> {formatDateDdMmYyyy(order.dueAt)}</div>}
          <div><span className="text-slate-500">Kreiran:</span> {fmtTs(order.createdAt)}</div>
          <div><span className="text-slate-500">Zadnja izmjena:</span> {fmtTs(order.updatedAt)}</div>
          <div>
            <span className="text-slate-500">Lokacija:</span>{" "}
            {order.serviceLocation ? (
              <>
                <span
                  className={`badge badge-tight mr-1 ${order.serviceLocation.kind === "STATIONARY" ? "badge-info" : "badge-success"}`}
                >
                  {order.serviceLocation.kind === "STATIONARY" ? "S" : "V"}
                </span>
                <b>{order.serviceLocation.label}</b>
              </>
            ) : (
              "—"
            )}
          </div>
          <div>
            <span className="text-slate-500">Kreirao:</span>{" "}
            <b className="font-mono">{order.createdByAccountUser?.username ?? "—"}</b>
          </div>
          <div>
            <span className="text-slate-500">Način servisa:</span>{" "}
            {describeWorkOrderServiceContext({
              deliveryMode: order.deliveryMode,
              serviceLocationKind: order.serviceLocation?.kind,
            })}
          </div>
          <div><span className="text-slate-500">Ukupno stavki:</span> {order.items.length}</div>
          <div><span className="text-slate-500">Servisirano:</span> {servicedItems.length}</div>
          <div><span className="text-slate-500">Placeholder:</span> {placeholders.length}</div>
          <div><span className="text-slate-500">Popunjeno, neservisirano:</span> {unservicedItems.length}</div>
          {scrapItems.length > 0 && <div><span className="text-slate-500">Rashodovano:</span> {scrapItems.length}</div>}
          {order.note && <div className="col-span-2"><span className="text-slate-500">Napomena:</span> {order.note}</div>}
        </div>
      </section>

      {/* TIMELINE */}
      <section className="surface p-4 space-y-1">
        <h2 className="text-lg font-semibold mb-3">Kronologija događaja</h2>
        <div className="relative space-y-0">
          {timeline.map((e, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-white text-sm ${e.color}`}>
                  {e.icon}
                </div>
                {i < timeline.length - 1 && <div className="w-px flex-1 bg-slate-200" />}
              </div>
              <div className="pb-4">
                <div className="text-[11px] text-slate-400 font-mono">{fmtTs(e.ts)}</div>
                <div className="text-sm font-medium text-slate-800">{e.text}</div>
                {e.detail && <div className="text-xs text-slate-500 mt-0.5">{e.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DETALJI PO STAVCI */}
      <section className="surface p-4 space-y-3">
        <h2 className="text-lg font-semibold">Detalji po stavci ({filledItems.length} popunjenih)</h2>
        {filledItems.map((item, idx) => {
          const ex = item.extinguisher;
          const isScrapped = !!ex && (ex.status === "SCRAPPED" || !!ex.scrapReason || !!ex.scrappedAt);
          const parts = item.parts.map((p) => `${p.snapshotCode ?? p.part.code} ${p.snapshotName ?? p.part.name}`);

          return (
            <div key={item.id} className={`rounded-lg border p-3 text-sm ${isScrapped ? "border-red-200 bg-red-50/50" : item.servicedAt ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"}`}>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">#{idx + 1}</span>
                <span className="font-mono text-xs">{ex?.internalCode ?? "-"}</span>
                {item.servicedAt && <span className="badge badge-success badge-tight">Servisiran</span>}
                {isScrapped && <span className="badge badge-danger badge-tight">Rashodovan</span>}
                {!item.servicedAt && !isScrapped && <span className="badge badge-warning badge-tight">Neservisiran</span>}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-slate-600">
                {ex && <div>Proizvođač: {displayManufacturer(ex.manufacturer)}</div>}
                {ex?.type && <div>Tip: {formatExtinguisherTypeName(ex.type)}</div>}
                {ex && <div>Serijski: {ex.serialNumber}</div>}
                {ex && <div>Godina: {ex.productionYear}</div>}
                {item.labelNumber && <div>Naljepnica: <b>{item.labelNumber}</b></div>}
                {item.servicer && <div>Serviser: {item.servicer.fullName}</div>}
                {item.servicedAt && <div>Servisirano: {fmtTs(item.servicedAt)}</div>}
                {item.internalDone && <div>Unutarnji pregled: DA{item.internalDoneAt ? ` (${fmtTs(item.internalDoneAt)})` : ""}</div>}
                {item.nextPeriodicDue && <div>PP vrijedi do: {formatDateDdMmYyyy(item.nextPeriodicDue)}</div>}
                {item.nextInternalDue && <div>UP vrijedi do: {formatDateDdMmYyyy(item.nextInternalDue)}</div>}
                {item.serviceLocationText && <div>Lokacija: {item.serviceLocationText}</div>}
                {parts.length > 0 && <div className="col-span-2">Dijelovi: {parts.join(", ")}</div>}
                {item.partsText && <div className="col-span-2">Dijelovi (tekst): {item.partsText}</div>}
                {item.serviceNote && <div className="col-span-2">Napomena: {item.serviceNote}</div>}
                {isScrapped && ex?.scrapReason && (
                  <div className="col-span-2 text-red-700">Razlog rashodovanja: {ex.scrapReason}</div>
                )}
                <div>Kreiran: {fmtTs(item.createdAt)}</div>
                <div>Ažuriran: {fmtTs(item.updatedAt)}</div>
              </div>
            </div>
          );
        })}

        {placeholders.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-700">Placeholder stavke: {placeholders.length}</div>
            <div className="mt-1 text-xs text-slate-500">
              {placeholders.map((p, i) => (
                <span key={p.id}>{i > 0 ? " · " : ""}Kreiran {fmtTs(p.createdAt)}</span>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
