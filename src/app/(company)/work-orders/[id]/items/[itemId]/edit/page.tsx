import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EditExtinguisherForm from "@/components/EditExtinguisherForm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { customerDisplayName } from "@/lib/customerDisplay";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id, itemId } = await params;

  const [order, item] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id, companyId: session.companyId },
      include: { customer: true },
    }),
    prisma.workOrderItem.findUnique({
      where: { id: itemId },
      include: { extinguisher: true },
    }),
  ]);

  if (!order) notFound();
  if (!item) notFound();
  if (item.workOrderId !== order.id) notFound();
  if (item.companyId !== session.companyId) notFound();
  if (item.isPlaceholder || !item.extinguisher) {
    notFound();
  }

  if (order.status === "LOCKED") {
    return (
      <main className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold">Nalog je zaključan</h1>
        <p className="text-slate-600">Nije moguće mijenjati podatke aparata.</p>
        <Link className="btn btn-outline px-4" href={`/work-orders/${order.id}`}>
          ← Povratak na Servisni nalog
        </Link>
      </main>
    );
  }

  const [manufacturers, types] = await Promise.all([
    prisma.manufacturer.findMany({
      orderBy: { name: "asc" },
      include: { supportedTypes: { select: { extinguisherTypeId: true } } },
    }),
    prisma.extinguisherType.findMany({
      orderBy: [{ code: "asc" }],
      include: { agent: true, construction: true },
    }),
  ]);

  const ext = item.extinguisher;

  return (
    <main className="max-w-3xl">
      <EditExtinguisherForm
        orderId={order.id}
        itemId={item.id}
        title="Uredi podatke aparata"
        subtitle={`Nalog: ${order.orderNumber} — ${customerDisplayName(order.customer)}`}
        manufacturers={manufacturers}
        types={types}
        initial={{
          internalCode: ext.internalCode,
          manufacturerId: ext.manufacturerId,
          extinguisherTypeId: ext.extinguisherTypeId,
          serialNumber: ext.serialNumber,
          productionYear: ext.productionYear,
          typeDescription: ext.typeDescription,
          serviceLocationText: item.serviceLocationText,
        }}
      />
    </main>
  );
}
