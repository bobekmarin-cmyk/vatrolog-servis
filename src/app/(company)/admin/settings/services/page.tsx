import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { syncCompanyServiceCatalog } from "@/lib/companyServiceCatalog";
import {
  formatVariantName,
  serviceKindLabel,
  type ServiceKindValue,
} from "@/lib/formatServiceItem";
import ServiceCatalogTable, {
  type ServiceCatalogRow,
} from "./ServiceCatalogTable";
import CustomServicesTable, {
  type CustomServiceRow,
} from "./CustomServicesTable";

export const dynamic = "force-dynamic";

export default async function ServicesCatalogPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  await syncCompanyServiceCatalog(null, { companyId: session.companyId });

  const customRowsDb = await prisma.companyCustomService.findMany({
    where: { companyId: session.companyId, deletedAt: null },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, price: true, isActive: true },
  });
  const customRows: CustomServiceRow[] = customRowsDb.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code ?? "",
    price: r.price ? Number(r.price) : null,
    isActive: r.isActive,
  }));

  const rowsDb = await prisma.companyServiceCatalog.findMany({
    where: { companyId: session.companyId },
    include: {
      agent: true,
      construction: true,
    },
  });

  const rows: ServiceCatalogRow[] = rowsDb
    .map((r) => {
      const itemLabel = formatVariantName({
        agent: r.agent
          ? { code: r.agent.code, label: r.agent.label, symbol: r.agent.symbol }
          : null,
        construction: r.construction
          ? {
              code: r.construction.code,
              label: r.construction.label,
              prefix: r.construction.prefix,
            }
          : null,
        capacity: r.capacity,
        fallbackLabel: r.fallbackLabel,
      });

      return {
        id: r.id,
        kind: r.kind as ServiceKindValue,
        kindLabel: serviceKindLabel(r.kind as ServiceKindValue),
        itemLabel,
        code: r.code,
        price: r.price != null ? Number(r.price) : null,
        _sort: {
          constructionSort: r.construction?.sortOrder ?? 999,
          agentSort: r.agent?.sortOrder ?? 999,
          capacity: r.capacity ?? 0,
          fallback: r.fallbackLabel ?? "",
          kindOrder: r.kind === "PERIODIC" ? 0 : 1,
        },
      };
    })
    .sort((a, b) => {
      if (a._sort.kindOrder !== b._sort.kindOrder) return a._sort.kindOrder - b._sort.kindOrder;
      if (a._sort.constructionSort !== b._sort.constructionSort) {
        return a._sort.constructionSort - b._sort.constructionSort;
      }
      if (a._sort.agentSort !== b._sort.agentSort) return a._sort.agentSort - b._sort.agentSort;
      if (a._sort.capacity !== b._sort.capacity) return a._sort.capacity - b._sort.capacity;
      return a._sort.fallback.localeCompare(b._sort.fallback, "hr");
    })
    .map(({ _sort, ...rest }) => {
      void _sort;
      return rest;
    });

  return (
    <div className="w-full space-y-6">
      <div>
        <div className="h1">Šifre usluga</div>
        <p className="subtle mt-1 max-w-3xl">
          Računovodstvene šifre za katalog usluga po varijanti aparata i vlastite dodatne usluge.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch md:gap-8">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Šifre po varijanti aparata</h2>
          <div className="subtle text-pretty min-h-[7rem]">
            Ovdje upišite šifre za svaku moguću uslugu (Periodični i Unutarnji pregled) po varijanti
            aparata. Varijanta = izvedba + sredstvo punjenja + kapacitet, pa isti tip aparata (npr. P9
            ST prah) ima <b>jednu</b> stavku bez obzira na koliko proizvođača ga nudi. Šifra se
            automatski ispisuje na otpremnici i olakšava izradu računa. Ako šifra nije upisana, na
            otpremnici će se prikazati crta („—“). <b>Cijena</b> je opcionalna evidencija za vašu
            knjigovodstvenu usklađenost.
          </div>
          <ServiceCatalogTable rows={rows} />
        </section>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col space-y-3 border-t border-slate-200 pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-8">
          <h2 className="text-base font-semibold text-slate-900">Vlastite usluge</h2>
          <div className="subtle text-pretty min-h-[7rem]">
            Slobodne usluge koje sami definirate i možete dodati na bilo koju servisnu stavku iz boxa
            „Dodatne usluge“. Naziv mora biti jedinstven unutar vaše tvrtke (druge tvrtke mogu imati
            isti naziv). Deaktivirana usluga se ne nudi u dropdownu, ali ostaje vidljiva na već
            povezanim stavkama.
          </div>
          <CustomServicesTable initialRows={customRows} />
        </section>
      </div>
    </div>
  );
}
