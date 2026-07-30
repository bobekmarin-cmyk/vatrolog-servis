import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatExtinguisherTypeName, formatAgentLabel } from "@/lib/formatExtinguisherType";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { WORK_ORDER_ITEM_ORDER_BY, workOrderItemRbr } from "@/lib/workOrderItemOrder";

function agentLabel(a: { code?: string; label?: string | null; symbol?: string | null } | null | undefined) {
  if (!a) return "-";
  return a.label ?? formatAgentLabel(a);
}

export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      items: {
        orderBy: WORK_ORDER_ITEM_ORDER_BY,
        include: {
          servicer: true,
          extinguisher: {
            include: { manufacturer: true, type: { include: { agent: true, construction: true } } },
          },
        },
      },
    },
  });

  if (!order) notFound();

  await prisma.documentLog.create({
    data: { companyId: session.companyId, workOrderId: order.id, docType: "REGISTER_VIEW" },
  });

  const rows = order.items
    .map((i, idx) => ({ item: i, rbr: workOrderItemRbr(idx) }))
    .filter(({ item }) => !item.isPlaceholder && item.extinguisher) // samo popunjeni
    .map(({ item: i, rbr }) => {
      const ex = i.extinguisher!;
      return {
        rbr,
        manufacturer: displayManufacturer(ex.manufacturer),
        type: ex.type ? formatExtinguisherTypeName(ex.type) : "-",
        agent: agentLabel(ex.type?.agent ?? null) || "-",
        serial: ex.serialNumber,
        year: ex.productionYear,
        internal: i.internalDone ? "DA" : "NE",
        parts: i.partsText ?? "",
        nextPeriodic: formatDateDdMmYyyy(i.nextPeriodicDue),
        nextInternal: formatDateDdMmYyyy(i.nextInternalDue),
        location: i.serviceLocationText ?? "-",
        label: i.labelNumber ?? "-",
        servicer: i.servicer?.fullName ?? "-",
        servicedAt: formatDateDdMmYyyy(i.servicedAt),
      };
    });

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Upisnik periodičnog pregleda</h1>
      <p className="text-sm text-gray-600 mt-1">
        Nalog {order.orderNumber} — {customerDisplayName(order.customer)} ({order.customer.oib})
      </p>

      <div className="mt-4 overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2">R.br.</th>
              <th className="p-2">Proizvođač</th>
              <th className="p-2">Tip</th>
              <th className="p-2">Punjenje</th>
              <th className="p-2">Serijski</th>
              <th className="p-2">God.</th>
              <th className="p-2">Unutarnji</th>
              <th className="p-2">Dijelovi</th>
              <th className="p-2">Idući periodični</th>
              <th className="p-2">Idući unutarnji</th>
              <th className="p-2">Lokacija</th>
              <th className="p-2">Naljepnica</th>
              <th className="p-2">Serviser</th>
              <th className="p-2">Datum servisa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rbr} className="border-t">
                <td className="p-2">{r.rbr}</td>
                <td className="p-2">{r.manufacturer}</td>
                <td className="p-2">{r.type}</td>
                <td className="p-2">{r.agent}</td>
                <td className="p-2">{r.serial}</td>
                <td className="p-2">{r.year}</td>
                <td className="p-2">{r.internal}</td>
                <td className="p-2">{r.parts}</td>
                <td className="p-2">{r.nextPeriodic}</td>
                <td className="p-2">{r.nextInternal}</td>
                <td className="p-2">{r.location}</td>
                <td className="p-2">{r.label}</td>
                <td className="p-2">{r.servicer}</td>
                <td className="p-2">{r.servicedAt}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td className="p-6 text-gray-500" colSpan={14}>
                  Nema popunjenih aparata u nalogu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-2">(Ispis je HTML — generiranje u PDF dodamo u sljedećem koraku.)</p>
    </main>
  );
}

