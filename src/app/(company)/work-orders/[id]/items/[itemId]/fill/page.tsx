import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AddExtinguisherForm from "@/components/AddExtinguisherForm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { customerDisplayName } from "@/lib/customerDisplay";

export default async function FillItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id, itemId } = await params;

  const [order, item, authorizations, types] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id, companyId: session.companyId },
      include: { customer: true },
    }),
    prisma.workOrderItem.findUnique({
      where: { id: itemId },
      include: { extinguisher: true },
    }),
    prisma.companyManufacturerAuthorization.findMany({
      where: { companyId: session.companyId, active: true },
      include: {
        manufacturer: {
          include: { supportedTypes: { select: { extinguisherTypeId: true } } },
        },
      },
    }),
    prisma.extinguisherType.findMany({
      orderBy: [{ code: "asc" }],
      include: { agent: true, construction: true },
    }),
  ]);

  if (!order) notFound();
  if (!item) notFound();
  if (item.workOrderId !== order.id) notFound();
  if (item.companyId !== session.companyId) notFound();

  if (order.status === "LOCKED") {
    return (
      <main className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold">Nalog je zaključan</h1>
        <p className="text-slate-600">Nije moguće mijenjati podatke.</p>
        <Link className="btn btn-outline px-4" href={`/work-orders/${order.id}`}>
          ← Povratak na Servisni nalog
        </Link>
      </main>
    );
  }

  const manufacturers = authorizations
    .map((a) => a.manufacturer)
    .sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      return a.name.localeCompare(b.name, "hr");
    });

  return (
    <main className="max-w-3xl">
      <AddExtinguisherForm
        orderId={order.id}
        itemId={item.id}
        title="Dodaj vatrogasni aparat"
        subtitle={`Nalog: ${order.orderNumber} — ${customerDisplayName(order.customer)}`}
        manufacturers={manufacturers}
        types={types}
      />
    </main>
  );
}

