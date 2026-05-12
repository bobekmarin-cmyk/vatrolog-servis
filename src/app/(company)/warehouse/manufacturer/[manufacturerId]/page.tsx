import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ManufacturerPartsTable from "./ManufacturerPartsTable";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import {
  getEnabledPlatformManufacturers,
  getCompanyPartOverridesByPartIds,
  partActiveForCompany,
  partDisplayCode,
  partManufacturerCode,
} from "@/lib/partsCatalog";

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
    select: { id: true, name: true, displayName: true },
  });
  if (!manufacturer) notFound();

  const enabled = await getEnabledPlatformManufacturers(prisma, {
    companyId: session.companyId,
    manufacturerIds: [manufacturerId],
  });
  const platformEnabled = enabled.has(manufacturerId);

  const allParts = await prisma.part.findMany({
    where: {
      manufacturerId,
      OR: [{ companyId: null }, { companyId: session.companyId }],
    },
    orderBy: [{ companyId: "asc" }, { name: "asc" }, { code: "asc" }],
    select: {
      id: true,
      manufacturerId: true,
      companyId: true,
      code: true,
      manufacturerCode: true,
      name: true,
      active: true,
      defaultPrice: true,
      unit: true,
      stocks: { where: { companyId: session.companyId } },
    },
  });

  const overrides = await getCompanyPartOverridesByPartIds(prisma, {
    companyId: session.companyId,
    partIds: allParts.map((p) => p.id),
  });

  const rows = allParts
    .filter((p) => {
      const isCustom = p.companyId !== null;
      if (isCustom) return true; // vlastite uvijek prikazujemo (i neaktivne)
      return platformEnabled; // platform samo ako je toggle ON
    })
    .map((p) => {
      const ov = overrides.get(p.id) ?? null;
      const s = p.stocks[0];
      const isCustom = p.companyId !== null;
      return {
        partId: p.id,
        displayCode: partDisplayCode(p, ov),
        manufacturerCode: partManufacturerCode(p),
        name: p.name,
        stockQty: s?.stockQty ?? 0,
        minStockQty: s?.minStockQty ?? 0,
        hasStockRow: !!s,
        active: partActiveForCompany(p, ov),
        partActive: p.active,
        isCustom,
      };
    });

  const returnTo = `/warehouse/manufacturer/${manufacturerId}`;

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
            Popis dostupnih dijelova ovog proizvođača i njihovo trenutno stanje u vašem skladištu.
            Uređivanje šifri, naziva i statusa dijelova radi se u{" "}
            <Link
              href={`/admin/settings/parts?manufacturerId=${manufacturerId}`}
              className="font-medium text-slate-900 underline"
            >
              Postavke → Rezervni dijelovi
            </Link>
            .
          </p>
        </div>
        <Link href="/warehouse/receipts/new" className="btn btn-outline h-10">
          + Nova primka
        </Link>
      </div>

      {!platformEnabled ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Katalog dijelova proizvođača je isključen za ovog proizvođača — prikazuju se samo vaši vlastiti
          dijelovi. Možete ga uključiti u{" "}
          <Link
            href={`/admin/settings/parts?manufacturerId=${manufacturerId}`}
            className="font-medium underline"
          >
            Postavke → Rezervni dijelovi
          </Link>
          .
        </div>
      ) : null}

      <ManufacturerPartsTable
        manufacturerId={manufacturer.id}
        rows={rows}
        returnTo={returnTo}
      />
    </main>
  );
}
