import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requirePlatformSession } from "@/lib/platformAuth";

export default async function PlatformManufacturersPage() {
  await requirePlatformSession();
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { supportedTypes: true, parts: { where: { companyId: null } }, extinguishers: true } },
    },
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Proizvođači</h1>
        <p className="mt-1 text-sm text-slate-600">
          Unos i uređivanje proizvođača. Tipove aparata i dijelove dodaješ na detalju pojedinog proizvođača.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link className="btn btn-primary px-4" href="/platform/manufacturers/new">
          + Novi proizvođač
        </Link>
        <Link className="btn btn-outline px-4" href="/platform/katalog">
          Katalog (izvedbe / sredstva) →
        </Link>
      </div>

      <section className="surface">
        <div className="surface-header">
          <h2 className="h1">Popis</h2>
          <span className="subtle">Ukupno: {manufacturers.length}</span>
        </div>
        <div className="h-px bg-black/10" />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-600">
                <th className="p-3">Naziv</th>
                <th className="p-3">Tipovi</th>
                <th className="p-3">Dijelovi</th>
                <th className="p-3">Aparati</th>
                <th className="p-3 text-right">Akcija</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {manufacturers.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{m.name}</span>
                      {m.displayName && m.displayName.trim() && (
                        <span
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono uppercase text-slate-700"
                          title="Prikaz na dokumentima"
                        >
                          {m.displayName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-center">{m._count.supportedTypes}</td>
                  <td className="p-3 text-center">{m._count.parts}</td>
                  <td className="p-3 text-center">{m._count.extinguishers}</td>
                  <td className="p-3 text-right">
                    <Link
                      className="btn btn-outline h-8 px-3 text-xs"
                      href={`/platform/manufacturers/${m.id}`}
                    >
                      Uredi
                    </Link>
                  </td>
                </tr>
              ))}
              {manufacturers.length === 0 && (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={5}>
                    Nema proizvođača.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
