import { prisma } from "@/lib/prisma";
import PlatformTabs from "@/components/PlatformTabs";
import PlatformCatalogManager from "@/components/PlatformCatalogManager";
import { requirePlatformSession } from "@/lib/platformAuth";

export const dynamic = "force-dynamic";

export default async function PlatformCatalogPage() {
  await requirePlatformSession();
  const [agents, constructions] = await Promise.all([
    prisma.agentType.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.construction.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  return (
    <main className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Katalog</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upravljanje izvedbama aparata i sredstvima gašenja. Ove vrijednosti koristi cijela platforma kod unosa novih tipova aparata.
        </p>
      </div>

      <PlatformTabs
        tabs={[
          { id: "constructions", label: "Izvedbe" },
          { id: "agents", label: "Sredstva gašenja" },
        ]}
      >
        <PlatformCatalogManager mode="constructions" constructions={constructions} />
        <PlatformCatalogManager mode="agents" agents={agents} />
      </PlatformTabs>
    </main>
  );
}
