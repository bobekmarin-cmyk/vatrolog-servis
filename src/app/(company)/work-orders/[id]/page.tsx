import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import DeleteItemForm from "@/components/DeleteItemForm";
import { calcValidUntil, isStillValid } from "@/lib/validity";
import { formatExtinguisherTypeParts } from "@/lib/formatExtinguisherType";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import WorkOrderStatusBadge from "@/components/WorkOrderStatusBadge";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import WorkOrderDateForm from "@/components/WorkOrderDateForm";
import EditWorkOrderCustomerButton from "@/components/EditWorkOrderCustomerButton";
import PlaceholderAddForm from "@/components/PlaceholderAddForm";
import ScanExtinguisherModal from "@/components/ScanExtinguisherModal";
import {
  WorkOrderExtinguisherDrawerButton,
  WorkOrderExtinguisherDrawerProvider,
} from "@/components/WorkOrderExtinguisherDrawer";
import {
  WorkOrderItemRow,
  WorkOrderRowHighlightProvider,
} from "@/components/WorkOrderRowHighlight";
import {
  WorkOrderServiceDrawerButton,
  WorkOrderServiceDrawerProvider,
} from "@/components/WorkOrderServiceDrawer";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import WorkOrderDocumentsMenu from "@/components/WorkOrderDocumentsMenu";
import { describeWorkOrderServiceContext } from "@/lib/workOrderDeliveryDisplay";
import PendingSubmitForm from "@/components/PendingSubmitForm";
import { getTenantMailStatus } from "@/lib/tenantMail";
import { getCompanyPlan, planAllows, planUpgradeMessage } from "@/lib/subscriptionPlan";
import { receiptFloorBlocksDelete, receiptFloorMessage } from "@/lib/workOrderReceiptFloor";
import {
  loadExtinguisherFormCatalog,
  type ExtinguisherEditInitial,
} from "@/lib/extinguisherFormCatalog";

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

export default async function ServiceViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ dn?: string; inv?: string; item?: string; mode?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  if (!id) notFound();

  const sp = searchParams ? await searchParams : undefined;
  const dnFlash = sp?.dn;
  const invFlash = sp?.inv;
  const drawerItemId = sp?.item;
  const serviceDrawerRequested = sp?.mode === "service";
  const drawerMode = sp?.mode === "edit" ? "edit" : "fill";

  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      department: { select: { id: true, name: true } },
      serviceLocation: { select: { kind: true, label: true } },
      createdByAccountUser: { select: { username: true } },
      items: {
        orderBy: [{ isPlaceholder: "asc" }, { servicedAt: "asc" }, { createdAt: "asc" }],
        include: {
          servicer: true,
          extinguisher: { include: { manufacturer: true, type: { include: { agent: true, construction: true } } } },
        },
      },
      deliveryNotes: {
        orderBy: { issuedAt: "asc" },
        select: {
          id: true,
          number: true,
          issuedAt: true,
          supersededAt: true,
          pdfStoragePath: true,
        },
      },
      eracuniInvoice: {
        select: {
          id: true,
          status: true,
          number: true,
          errorMessage: true,
          pdfStoragePath: true,
        },
      },
    },
  });

  if (!order) notFound();

  const total = order.items.length;
  const servicedCount = order.items.filter((i) => i.servicedAt).length;
  const isLocked = order.status === "LOCKED";
  const hasAnyServiced = order.items.some((i) => !!i.servicedAt || !!i.labelNumber);
  const deleteBlockedReason = receiptFloorBlocksDelete({
    itemCount: total,
    receivedQty: order.receivedQty,
  })
    ? receiptFloorMessage(order.receivedQty)
    : undefined;

  // Sporedni upiti ne ovise jedan o drugom — paralelno da refresh nakon
  // spremanja u draweru bude što kraći.
  const [plan, eracuniSettings, mailStatus, extinguisherCatalog] = await Promise.all([
    getCompanyPlan(session.companyId),
    prisma.companyERacuniSettings.findUnique({
      where: { companyId: session.companyId },
      select: { enabled: true },
    }),
    getTenantMailStatus(session.companyId),
    // Katalog unaprijed — drawer se otvara odmah bez API čekanja.
    isLocked ? Promise.resolve(null) : loadExtinguisherFormCatalog(session.companyId),
  ]);

  const eracuniEnabled = !!eracuniSettings?.enabled && planAllows(plan, "INVOICING_INTEGRATIONS");
  const invoice = order.eracuniInvoice;
  const unlockBlocked = !!invoice && invoice.status !== "ERROR";

  const mailPlanAllowed = planAllows(plan, "MAIL_SENDING");
  const mailConnected = mailPlanAllowed && !!mailStatus.activeProvider;

  const editInitialByItemId: Record<string, ExtinguisherEditInitial> = {};
  if (!isLocked) {
    for (const item of order.items) {
      const ex = item.extinguisher;
      if (item.isPlaceholder || !ex) continue;
      editInitialByItemId[item.id] = {
        internalCode: ex.internalCode,
        manufacturerId: ex.manufacturerId,
        extinguisherTypeId: ex.extinguisherTypeId,
        serialNumber: ex.serialNumber,
        productionYear: ex.productionYear,
        typeDescription: ex.typeDescription,
        serviceLocationText: item.serviceLocationText,
      };
    }
  }

  // Prvi aparat koji čeka servis — drawer mu podatke povuče u pozadini nakon učitavanja.
  const idleServicePrefetchIds = isLocked
    ? []
    : order.items
        .filter((i) => !i.isPlaceholder && !!i.extinguisher && !i.servicedAt)
        .slice(0, 1)
        .map((i) => i.id);

  const issuedDeliveryNotes = order.deliveryNotes.filter((n) => n.pdfStoragePath);
  const activeDeliveryNote = issuedDeliveryNotes.find((n) => !n.supersededAt) ?? null;
  const hasShippedDeliveryNote = !!activeDeliveryNote;
  const remaining = Math.max(0, total - servicedCount);
  const pct = total > 0 ? Math.round((servicedCount / total) * 100) : 0;
  const allDone = total > 0 && servicedCount === total;

  const dnFlashMessage: Record<string, { tone: "ok" | "err"; text: string }> = {
    issued_ok: { tone: "ok", text: "Otpremnica je izdana i spremljena." },
    reissued_ok: { tone: "ok", text: "Nova otpremnica je izdana; prethodna je označena kao zamijenjena." },
    not_locked: { tone: "err", text: "Nalog mora biti zaključen prije izdavanja otpremnice." },
    already: { tone: "err", text: "Otpremnica je već izdana." },
    no_active: { tone: "err", text: "Nema aktivne otpremnice za zamjenu." },
    fail: { tone: "err", text: "Izdavanje otpremnice nije uspjelo. Pokušajte ponovno ili kontaktirajte podršku." },
  };
  const flash = dnFlash && dnFlashMessage[dnFlash] ? dnFlashMessage[dnFlash] : null;

  const invFlashMessage: Record<string, { tone: "ok" | "err"; text: string }> = {
    created_ok: { tone: "ok", text: "Koncept računa je kreiran u e-računima. Izdajte ga u programu e-računi, zatim ovdje kliknite „Provjeri račun”." },
    issued_ok: { tone: "ok", text: "Račun je izdan — PDF je preuzet i vidljiv je kupcu u portalu." },
    still_draft: { tone: "ok", text: "Račun je još uvijek koncept u e-računima. Izdajte ga tamo pa ponovno provjerite." },
    not_configured: { tone: "err", text: "e-računi integracija nije uključena. Podesite je u Postavke → Integracije." },
    plan_required: { tone: "err", text: planUpgradeMessage("INVOICING_INTEGRATIONS") },
    unlock_blocked: {
      tone: "err",
      text: "Nalog se ne može otključati jer za njega postoji račun u e-računima. U iznimnim slučajevima kontaktirajte podršku (VatroLog) za otključavanje.",
    },
    already_exists: { tone: "err", text: "Račun za ovaj nalog već postoji u e-računima." },
    no_invoice: { tone: "err", text: "Za ovaj nalog još nije kreiran račun." },
    problems: { tone: "err", text: "Račun nije kreiran — nedostaju šifre ili cijene (detalji ispod)." },
    api_error: { tone: "err", text: "Komunikacija s e-računima nije uspjela. Detalji su zabilježeni ispod, pokušajte ponovno." },
  };
  const invFlashBox = invFlash && invFlashMessage[invFlash] ? invFlashMessage[invFlash] : null;

  return (
    <main className="space-y-6">
      {invFlashBox ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            invFlashBox.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {invFlashBox.text}
        </div>
      ) : null}

      {invoice?.status === "ERROR" && invoice.errorMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <div className="font-semibold">Račun nije kreiran:</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {invoice.errorMessage.split("\n").map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {flash ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            flash.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      {issuedDeliveryNotes.length >= 2 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Izdane su više otpremnice:{" "}
          <span className="font-mono font-semibold">{issuedDeliveryNotes.map((n) => n.number).join(", ")}</span>.
          Za ispis i slanje kupcu vrijedi aktivna:{" "}
          <span className="font-mono font-semibold">{activeDeliveryNote?.number ?? "—"}</span>.
        </div>
      ) : null}

      {/* NASLOV + SVI GUMBI U JEDNOM REDU */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold leading-none">Servisni nalog</h1>
          <span className="text-lg leading-none text-slate-600 font-medium">{order.orderNumber}</span>
          <span className="text-sm leading-none text-slate-500">{fmtDotDate(order.receivedAt)}</span>
          <WorkOrderStatusBadge status={order.status} hasShippedDeliveryNote={hasShippedDeliveryNote} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn btn-outline px-4" href="/work-orders">
            ← Nalozi
          </Link>
          <WorkOrderDocumentsMenu
            workOrderId={order.id}
            orderNumber={order.orderNumber}
            customerName={customerDisplayName(order.customer)}
            customerEmail={order.customer.email}
            mailConnected={mailConnected}
            mailDisabledTitle={!mailPlanAllowed ? planUpgradeMessage("MAIL_SENDING") : undefined}
            isLocked={isLocked}
            isAdmin={session.role === "ADMIN"}
            deliveryNoteIssued={hasShippedDeliveryNote}
          />
          {eracuniEnabled && isLocked && (!invoice || invoice.status === "ERROR") ? (
            <PendingSubmitForm
              action={`/api/work-orders/${order.id}/eracuni-invoice/create`}
              method="post"
              className="inline"
              pendingTitle="Kreiram račun..."
              pendingMessage="Molimo pričekajte, stavke naloga se šalju u e-račune."
            >
              <button type="submit" className="btn btn-primary px-3 text-sm">
                {invoice?.status === "ERROR" ? "Ponovi račun" : "Kreiraj račun"}
              </button>
            </PendingSubmitForm>
          ) : null}
          {eracuniEnabled && invoice?.status === "DRAFT" ? (
            <PendingSubmitForm
              action={`/api/work-orders/${order.id}/eracuni-invoice/refresh`}
              method="post"
              className="inline"
              pendingTitle="Provjeravam račun..."
              pendingMessage="Molimo pričekajte, dohvaća se status računa iz e-računa."
            >
              <button
                type="submit"
                className="btn btn-outline px-3 text-sm"
                title={`Koncept računa${invoice.number ? ` ${invoice.number}` : ""} čeka izdavanje u e-računima. Klikni za provjeru statusa.`}
              >
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500" />
                Provjeri račun
              </button>
            </PendingSubmitForm>
          ) : null}
          {invoice?.status === "ISSUED" && invoice.pdfStoragePath ? (
            <a
              className="btn btn-outline px-3 text-sm"
              href={`/work-orders/${order.id}/invoice/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Račun ${invoice.number ?? ""} (izdan)`}
            >
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Račun{invoice.number ? ` ${invoice.number}` : ""}
            </a>
          ) : null}
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
          ) : unlockBlocked ? (
            <span
              className="btn btn-outline cursor-not-allowed px-4 text-slate-400"
              title="Za nalog postoji račun u e-računima pa se više ne može otključati. U iznimnim slučajevima otključavanje može napraviti VatroLog podrška."
            >
              🔒 Zaključano (račun)
            </span>
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
          <div className="flex items-start justify-between gap-2">
            <div className="text-base font-bold text-slate-900 clamp-2">
              {customerDisplayName(order.customer)}
            </div>
            {!isLocked ? (
              <EditWorkOrderCustomerButton
                orderId={order.id}
                customer={{
                  id: order.customer.id,
                  name: order.customer.name,
                  shortName: order.customer.shortName,
                  oib: order.customer.oib,
                  address: order.customer.address,
                  contactPerson: order.customer.contactPerson,
                  phone: order.customer.phone,
                }}
                departmentId={order.department?.id ?? ""}
                note={order.note ?? ""}
              />
            ) : null}
          </div>
          <div className="mt-1 space-y-0.5 text-xs text-slate-600">
            {order.customer.address ? <div>{order.customer.address}</div> : null}
            {order.customer.email ? <div>{order.customer.email}</div> : null}
            {order.customer.phone ? <div>{order.customer.phone}</div> : null}
            {order.department?.name ? <div className="text-slate-500">{order.department.name}</div> : null}
            {order.note ? (
              <div className="mt-1 border-t border-black/5 pt-1 text-slate-500">
                <span className="font-medium text-slate-600">Napomena:</span> {order.note}
              </div>
            ) : null}
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
          {order.receivedQty > 0 ? (
            <div className="mt-1.5 text-[10px] text-slate-500">
              Primka:{" "}
              <span className="font-semibold tabular-nums text-slate-700">{order.receivedQty}</span> kom — broj stavki
              ne može pasti ispod te količine.
            </div>
          ) : null}
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
      <WorkOrderRowHighlightProvider>
      <WorkOrderServiceDrawerProvider
        orderId={order.id}
        orderNumber={order.orderNumber}
        customerName={customerDisplayName(order.customer)}
        locked={isLocked}
        initialItemId={serviceDrawerRequested ? drawerItemId : undefined}
        idlePrefetchItemIds={idleServicePrefetchIds}
      >
      <WorkOrderExtinguisherDrawerProvider
        orderId={order.id}
        orderNumber={order.orderNumber}
        customerName={customerDisplayName(order.customer)}
        locked={isLocked}
        catalog={extinguisherCatalog}
        editInitialByItemId={editInitialByItemId}
        initialItemId={serviceDrawerRequested ? undefined : drawerItemId}
        initialMode={drawerMode}
      >
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

                const isScrapped =
                  !!ex && (ex.status === "SCRAPPED" || !!ex.scrapReason || !!ex.scrappedAt);

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
                  <WorkOrderItemRow key={item.id} itemId={item.id}>
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
                            <WorkOrderExtinguisherDrawerButton itemId={item.id} mode="fill" />
                          ) : (
                            <>
                              <WorkOrderExtinguisherDrawerButton itemId={item.id} mode="edit" />
                              <WorkOrderServiceDrawerButton itemId={item.id} serviced={isServiced} />
                            </>
                          )}

                          {session.role === "ADMIN" && (
                            <DeleteItemForm
                              action={`/api/work-orders/${order.id}/items/${item.id}/delete`}
                              disabled={false}
                              blockedReason={deleteBlockedReason}
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
                  </WorkOrderItemRow>
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
      </WorkOrderExtinguisherDrawerProvider>
      </WorkOrderServiceDrawerProvider>
      </WorkOrderRowHighlightProvider>

      <p className="mt-4 text-xs text-gray-500">
        Pravilo PP roka: datum radnog naloga 10.01.2026. → vrijedi do 01/2027 (kraj mjeseca + 1 godina).
      </p>
    </main>
  );
}

