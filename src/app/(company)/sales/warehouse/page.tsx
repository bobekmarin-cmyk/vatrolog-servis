import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SalesWarehousePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Skladište prodaje</h1>
      </div>

      <section className="surface">
        <div className="surface-body space-y-3 p-8 text-center">
          <div className="text-5xl">📦</div>
          <h2 className="text-xl font-semibold">Modul u izradi</h2>
          <p className="mx-auto max-w-xl text-sm text-slate-600">
            Skladište robe za prodaju (odvojeno od servisnog skladišta) dolazi u jednoj od idućih verzija.
            Planirano: vlastiti šifrarnik robe, stanja, minimalne količine i automatsko umanjenje kod
            zatvaranja prodajnog naloga.
          </p>
          <p className="text-xs text-slate-500">
            Ako želite da ovaj modul postane prioritet, javite nam.
          </p>
        </div>
      </section>
    </main>
  );
}
