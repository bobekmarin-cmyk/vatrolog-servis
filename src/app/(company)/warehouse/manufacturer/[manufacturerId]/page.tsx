import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ManufacturerPartsTable from "./ManufacturerPartsTable";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

export const dynamic = "force-dynamic";

export default async function ManufacturerWarehousePage({
  params,
}: {
  params: Promise<{ manufacturerId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { manufacturerId } = await params;

  const auth = await prisma.companyManufacturerAuthorization.findFirst({
    where: { companyId: session.companyId, manufacturerId, active: true },
    select: { id: true },
  });
  if (!auth) notFound();

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id: manufacturerId },
    select: {
      id: true,
      name: true,
      supportedTypes: {
        include: {
          extinguisherType: {
            include: { agent: true, construction: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!manufacturer) notFound();

  const parts = await prisma.part.findMany({
    where: {
      manufacturerId,
      active: true,
      OR: [{ companyId: null }, { companyId: session.companyId }],
    },
    orderBy: [{ name: "asc" }, { code: "asc" }],
    include: {
      stocks: { where: { companyId: session.companyId } },
    },
  });

  const rows = parts.map((p) => {
    const s = p.stocks[0];
    return {
      partId: p.id,
      code: p.code,
      name: p.name,
      stockQty: s?.stockQty ?? 0,
      minStockQty: s?.minStockQty ?? 0,
      hasStockRow: !!s,
      hidden: s?.hidden ?? false,
      isCustom: p.companyId !== null,
    };
  });

  return (
    <main className="space-y-6">
      <div>
        <Link
          href="/warehouse/parts"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline"
        >
          ← Natrag na skladište dijelova
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            <Link href="/warehouse/parts" className="hover:underline">
              Skladište dijelova
            </Link>{" "}
            / Proizvođač
          </div>
          <h1 className="text-3xl font-bold">{displayManufacturer(manufacturer)}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Popis aktivnih dijelova ovog proizvođača i njihovo trenutno stanje u vašem skladištu.
          </p>
        </div>
        <Link href="/warehouse/receipts/new" className="btn btn-outline h-10">
          + Nova primka
        </Link>
      </div>

      <ManufacturerPartsTable
        manufacturerId={manufacturer.id}
        rows={rows}
        extinguisherTypes={manufacturer.supportedTypes.map((st) => ({
          id: st.extinguisherType.id,
          label: formatExtinguisherTypeName(st.extinguisherType),
        }))}
      />
    </main>
  );
}
