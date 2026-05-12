import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { listSettingsPartsForCompany } from "@/lib/partsCatalog";
import PartsCatalogTabs, {
  type ManufacturerSettingRow,
  type PlatformPartRow,
  type CustomPartRow,
  type ExtinguisherTypeOption,
} from "./PartsCatalogTabs";

export const dynamic = "force-dynamic";

export default async function PartsCatalogSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ manufacturerId?: string; returnTo?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const initialManufacturerId =
    typeof sp.manufacturerId === "string" && sp.manufacturerId.trim() !== ""
      ? sp.manufacturerId.trim()
      : null;
  const returnTo =
    typeof sp.returnTo === "string" && sp.returnTo.trim().startsWith("/")
      ? sp.returnTo.trim()
      : null;

  const auths = await prisma.companyManufacturerAuthorization.findMany({
    where: { companyId: session.companyId, active: true },
    include: {
      manufacturer: {
        include: {
          _count: { select: { parts: { where: { companyId: null } } } },
          supportedTypes: {
            include: {
              extinguisherType: {
                include: { agent: true, construction: true },
              },
            },
          },
        },
      },
    },
  });

  const manufacturers = auths
    .map((a) => a.manufacturer)
    .sort((a, b) => displayManufacturer(a).localeCompare(displayManufacturer(b), "hr"));

  if (manufacturers.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <div className="h1">Rezervni dijelovi</div>
          <div className="subtle max-w-3xl">
            Upravljanje dijelovima proizvođača (platform katalog) i vlastitim katalogom rezervnih dijelova.
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          Nemate aktivnih ovlaštenja ni za jednog proizvođača. Prvo uključite ovlaštenja u{" "}
          <a className="font-medium text-slate-900 underline" href="/admin/settings/authorizations">
            Postavke → Ovlaštenja
          </a>
          .
        </div>
      </div>
    );
  }

  const manufacturerIds = manufacturers.map((m) => m.id);

  const settings = await prisma.companyPartCatalogSetting.findMany({
    where: { companyId: session.companyId, manufacturerId: { in: manufacturerIds } },
    select: { manufacturerId: true, usePlatformCatalog: true },
  });
  const settingsMap = new Map(settings.map((s) => [s.manufacturerId, s.usePlatformCatalog]));

  const manuRows: ManufacturerSettingRow[] = manufacturers
    .map((m) => ({
      id: m.id,
      name: displayManufacturer(m),
      platformPartsCount: m._count.parts,
      usePlatformCatalog: settingsMap.has(m.id) ? !!settingsMap.get(m.id) : true,
    }))
    .sort((a, b) => {
      // Proizvođači s dijelovima u katalogu proizvođača idu prvi (relevantniji za korisnika).
      const aHas = a.platformPartsCount > 0 ? 0 : 1;
      const bHas = b.platformPartsCount > 0 ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return a.name.localeCompare(b.name, "hr");
    });

  const focusManufacturer =
    initialManufacturerId && manufacturerIds.includes(initialManufacturerId)
      ? initialManufacturerId
      : null;

  const allParts = await listSettingsPartsForCompany(prisma, {
    companyId: session.companyId,
  });

  const typesByManufacturer = new Map<string, ExtinguisherTypeOption[]>();
  for (const m of manufacturers) {
    const list: ExtinguisherTypeOption[] = m.supportedTypes
      .map((st) => {
        const et = st.extinguisherType;
        const constructionLabel = et.construction?.label ?? "Ostalo";
        const constructionSort = et.construction?.sortOrder ?? 999;
        // Točan naziv iz platform kataloga, npr. "P6 (ST, prah)" ili "P1 (BO, pjena)".
        const fullLabel = formatExtinguisherTypeName({
          code: et.code,
          agent: et.agent,
          construction: et.construction,
        });
        return {
          id: et.id,
          label: fullLabel,
          fullLabel,
          constructionLabel,
          constructionSort,
        };
      })
      .sort(
        (a, b) =>
          a.constructionSort - b.constructionSort ||
          a.constructionLabel.localeCompare(b.constructionLabel, "hr") ||
          a.label.localeCompare(b.label, "hr"),
      );
    typesByManufacturer.set(m.id, list);
  }

  const platformRows: PlatformPartRow[] = allParts
    .filter((p) => !p.isCustom)
    .map((p) => ({
      partId: p.part.id,
      manufacturerId: p.part.manufacturerId,
      manufacturerCode: p.manufacturerCode ?? "",
      tenantCode: p.override?.code ?? "",
      name: p.part.name,
      defaultPrice: p.part.defaultPrice ? Number(p.part.defaultPrice) : null,
      tenantPrice: p.override?.price ? Number(p.override.price) : null,
      active: p.override?.active ?? true,
      partActive: p.part.active,
    }));

  const customRows: CustomPartRow[] = allParts
    .filter((p) => p.isCustom)
    .map((p) => ({
      partId: p.part.id,
      manufacturerId: p.part.manufacturerId,
      code: p.part.code,
      name: p.part.name,
      price: p.part.defaultPrice ? Number(p.part.defaultPrice) : null,
      unit: p.part.unit,
      active: p.part.active,
      typeIds: p.part.types.map((t) => t.extinguisherTypeId),
    }));

  return (
    <div className="space-y-6">
      <div>
        <div className="h1">Rezervni dijelovi</div>
        <p className="subtle max-w-3xl">
          Za svakog proizvođača postoje dva kataloga rezervnih dijelova:{" "}
          <b>dijelovi proizvođača</b> (platform katalog) — koje za vas održavamo i možete isključiti ako
          ne želite koristiti — i <b>vlastiti</b> dijelovi koje slobodno dodajete, šifrirate i
          uređujete.
        </p>
      </div>

      <PartsCatalogTabs
        manufacturers={manuRows}
        platformParts={platformRows}
        customParts={customRows}
        typesByManufacturer={Object.fromEntries(typesByManufacturer)}
        initialManufacturerId={focusManufacturer}
        returnTo={returnTo}
      />
    </div>
  );
}
