import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PlatformEditManufacturerForm from "@/components/PlatformEditManufacturerForm";
import ConfirmForm from "@/components/ConfirmForm";
import PlatformTabs from "@/components/PlatformTabs";
import ManufacturerTypesTab from "@/components/ManufacturerTypesTab";
import ManufacturerPartsTab from "@/components/ManufacturerPartsTab";
import { requirePlatformSession } from "@/lib/platformAuth";

export const dynamic = "force-dynamic";

export default async function PlatformManufacturerDetailPage({
  params,
}: {
  params: Promise<{ manufacturerId: string }>;
}) {
  await requirePlatformSession();
  const { manufacturerId } = await params;

  const [manufacturer, agents, constructions] = await Promise.all([
    prisma.manufacturer.findUnique({
      where: { id: manufacturerId },
      include: {
        _count: { select: { supportedTypes: true, extinguishers: true, parts: { where: { companyId: null } } } },
        supportedTypes: {
          include: {
            extinguisherType: {
              include: { agent: true, construction: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        parts: {
          where: { companyId: null },
          orderBy: [{ active: "desc" }, { code: "asc" }],
          include: {
            types: { select: { extinguisherTypeId: true } },
          },
        },
      },
    }),
    prisma.agentType.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.construction.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  if (!manufacturer) notFound();

  const typeRows = manufacturer.supportedTypes.map((r) => ({
    manufacturerId: r.manufacturerId,
    extinguisherType: {
      id: r.extinguisherType.id,
      code: r.extinguisherType.code,
      name: r.extinguisherType.name,
      capacity: r.extinguisherType.capacity,
      capacityUnit: r.extinguisherType.capacityUnit,
      agent: r.extinguisherType.agent,
      construction: r.extinguisherType.construction,
      internalRuleMode: r.extinguisherType.internalRuleMode,
      internalIntervalYears: r.extinguisherType.internalIntervalYears,
      internalOldThresholdYears: r.extinguisherType.internalOldThresholdYears,
      internalOldIntervalYears: r.extinguisherType.internalOldIntervalYears,
      internalYoungIntervalYears: r.extinguisherType.internalYoungIntervalYears,
    },
  }));

  // Sortiraj prema redoslijedu izvedbe (Stalni tlak → Bočica → CO2), pa po
  // kapacitetu i šifri — pomaže kod izbora dijelova i pri prikazu liste tipova.
  const sortedSupported = [...manufacturer.supportedTypes].sort((a, b) => {
    const sa = a.extinguisherType.construction?.sortOrder ?? 999;
    const sb = b.extinguisherType.construction?.sortOrder ?? 999;
    if (sa !== sb) return sa - sb;
    const ca = a.extinguisherType.capacity ?? 0;
    const cb = b.extinguisherType.capacity ?? 0;
    if (ca !== cb) return ca - cb;
    return a.extinguisherType.code.localeCompare(b.extinguisherType.code);
  });

  const availableTypesForParts = sortedSupported.map((r) => ({
    id: r.extinguisherType.id,
    code: r.extinguisherType.code,
    name: r.extinguisherType.name,
    agent: r.extinguisherType.agent ? { label: r.extinguisherType.agent.label } : null,
    construction: r.extinguisherType.construction
      ? {
          code: r.extinguisherType.construction.code,
          label: r.extinguisherType.construction.label,
          sortOrder: r.extinguisherType.construction.sortOrder,
        }
      : null,
  }));

  const partRows = manufacturer.parts.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    common: p.common,
    unit: p.unit,
    active: p.active,
    typeIds: p.types.map((t) => t.extinguisherTypeId),
  }));

  return (
    <main className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link className="text-sm text-slate-500 hover:text-slate-700" href="/platform/manufacturers">
            ← Proizvođači
          </Link>
          <h1 className="mt-1 text-3xl font-bold">{manufacturer.name}</h1>
          <div className="mt-1 text-xs text-slate-500">
            Tipova: {manufacturer._count.supportedTypes} · Dijelova: {manufacturer._count.parts} · Aparata u bazi: {manufacturer._count.extinguishers}
          </div>
        </div>
      </div>

      <PlatformTabs
        tabs={[
          { id: "details", label: "Detalji" },
          { id: "types", label: `Aparati (${manufacturer._count.supportedTypes})` },
          { id: "parts", label: `Dijelovi (${manufacturer._count.parts})` },
        ]}
      >
        <div className="space-y-4">
          <PlatformEditManufacturerForm
            action={`/api/platform/manufacturers/${manufacturer.id}/update`}
            initial={{
              name: manufacturer.name,
              displayName: manufacturer.displayName,
              oib: manufacturer.oib,
              address: manufacturer.address,
              contactPerson: manufacturer.contactPerson,
              contactEmail: manufacturer.contactEmail,
            }}
          />

          <section className="surface p-4">
            <h2 className="text-base font-semibold text-rose-700">Opasna zona</h2>
            <p className="mt-1 text-sm text-gray-600">
              Brisanje je moguće samo ako nijedan aparat u bazi ne koristi ovog proizvođača.
            </p>
            <ConfirmForm
              action={`/api/platform/manufacturers/${manufacturer.id}/delete`}
              method="post"
              confirmMessage="Obrisati proizvođača?"
              className="mt-3"
            >
              <button
                type="submit"
                className="btn bg-rose-600 text-white hover:bg-rose-700"
                disabled={manufacturer._count.extinguishers > 0}
              >
                Obriši proizvođača
              </button>
              {manufacturer._count.extinguishers > 0 && (
                <span className="ml-2 text-xs text-gray-500">
                  Nije moguće — {manufacturer._count.extinguishers} aparata u bazi.
                </span>
              )}
            </ConfirmForm>
          </section>
        </div>

        <ManufacturerTypesTab
          manufacturerId={manufacturer.id}
          agents={agents}
          constructions={constructions}
          rows={typeRows}
        />

        <ManufacturerPartsTab
          manufacturerId={manufacturer.id}
          availableTypes={availableTypesForParts}
          parts={partRows}
        />
      </PlatformTabs>
    </main>
  );
}
