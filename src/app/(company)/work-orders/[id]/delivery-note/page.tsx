import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { customerDisplayName } from "@/lib/customerDisplay";

function agentLabel(a: { label?: string | null; symbol?: string | null; code?: string } | null | undefined) {
  if (!a) return "-";
  return a.label ?? a.symbol ?? a.code ?? "-";
}

type GroupKey = string; // npr. "P6|PRAH"

export default async function DeliveryNotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      items: {
        orderBy: [{ isPlaceholder: "asc" }, { createdAt: "asc" }],
        include: {
          servicer: true,
          parts: { include: { part: true } },
          extinguisher: { include: { type: { include: { agent: true, construction: true } }, manufacturer: true } },
        },
      },
    },
  });

  if (!order) notFound();

  // Grupiramo samo popunjene stavke po tipu (code+agent ili name+agent)
  const realItems = order.items.filter((i) => !i.isPlaceholder && i.extinguisher);
  const groups = new Map<GroupKey, { typeName: string; agent: string; count: number }>();

  for (const it of realItems) {
    const ex = it.extinguisher!;
    const agent = ex.type?.agent ?? null;
    const typeName = ex.type ? formatExtinguisherTypeName(ex.type) : "-";
    const key = `${typeName}|${agent?.code ?? ""}`;

    if (!groups.has(key)) {
      groups.set(key, {
        typeName,
        agent: agentLabel(agent),
        count: 0,
      });
    }
    groups.get(key)!.count += 1;
  }

  // Sekcija: unutarnji pregledi (lista)
  const internals = realItems.filter((i) => i.internalDone);

  // Sekcija: ugrađeni dijelovi
  // Pravila prikaza:
  //  · Stupac koji ovdje renderiramo zajedno (`codes`) prikazuje
  //    "RAČUNOVODSTVENA_ŠIFRA NAZIV (TVORNIČKA)" — tvornička je u zagradi
  //    samo za platform dijelove kao referenca. Ako nema računovodstvene
  //    šifre, pokazujemo samo naziv.
  const partsCodes = realItems
    .filter((i) => (i.parts ?? []).length > 0)
    .map((i) => ({
      type: i.extinguisher?.type ? formatExtinguisherTypeName(i.extinguisher.type) : "-",
      agent: agentLabel(i.extinguisher?.type?.agent ?? null),
      serial: i.extinguisher?.serialNumber ?? "-",
      codes: (i.parts ?? [])
        .map((x) => {
          const isCustom = x.snapshotIsCustom ?? !!x.part.companyId;
          const name = (x.snapshotName ?? x.part.name ?? "").trim();
          const manuCode = isCustom
            ? null
            : ((x.snapshotManufacturerCode ?? x.part.manufacturerCode ?? "").trim() || null);
          const display = (x.snapshotCode ?? x.part.code ?? "").trim();
          let accountingCode = "";
          if (isCustom) accountingCode = display;
          else if (display && display !== manuCode) accountingCode = display;

          const head = accountingCode ? `${accountingCode} ${name}` : name;
          return manuCode ? `${head}  ${manuCode}` : head;
        })
        .filter((s) => s.length > 0)
        .join(", "),
    }));

  // Backward compatibility: slobodan tekst
  const partsText = realItems
    .filter((i) => (i.partsText ?? "").trim().length > 0)
    .map((i) => ({
      type: i.extinguisher?.type ? formatExtinguisherTypeName(i.extinguisher.type) : "-",
      agent: agentLabel(i.extinguisher?.type?.agent ?? null),
      serial: i.extinguisher?.serialNumber ?? "-",
      parts: i.partsText!,
    }));

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Otpremnica</h1>
      <p className="text-sm text-gray-600 mt-1">
        Nalog {order.orderNumber} — {customerDisplayName(order.customer)} ({order.customer.oib})
      </p>

      {/* Grupirano po tipu */}
      <div className="mt-4 rounded border p-4">
        <h2 className="font-semibold mb-2">Stavke po tipu aparata</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2">Tip</th>
              <th className="p-2">Punjenje</th>
              <th className="p-2">Količina</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(groups.values()).map((g, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2">{g.typeName}</td>
                <td className="p-2">{g.agent}</td>
                <td className="p-2">{g.count}</td>
              </tr>
            ))}
            {groups.size === 0 && (
              <tr>
                <td className="p-4 text-gray-500" colSpan={3}>
                  Nema popunjenih aparata u nalogu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Unutarnji pregledi */}
      <div className="mt-6 rounded border p-4">
        <h2 className="font-semibold mb-2">Unutarnji pregled</h2>
        {internals.length === 0 ? (
          <p className="text-sm text-gray-600">Nema odrađenih unutarnjih pregleda.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {internals.map((i) => (
              <li key={i.id}>
                {i.extinguisher?.type ? formatExtinguisherTypeName(i.extinguisher.type) : "-"} ({agentLabel(i.extinguisher?.type?.agent ?? null)}) — ser.{" "}
                {i.extinguisher?.serialNumber ?? "-"}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ugrađeni dijelovi */}
      <div className="mt-6 rounded border p-4">
        <h2 className="font-semibold mb-2">Ugrađeni dijelovi (šifre)</h2>
        {partsCodes.length === 0 ? (
          <p className="text-sm text-gray-600">Nema evidentiranih dijelova.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm space-y-1">
            {partsCodes.map((p, idx) => (
              <li key={idx}>
                {p.type} ({p.agent}) — ser. {p.serial}: <span className="font-mono">{p.codes}</span>
              </li>
            ))}
          </ul>
        )}

        {partsText.length > 0 ? (
          <>
            <div className="mt-4 h-px bg-black/10" />
            <h3 className="font-semibold mt-4 mb-2">Napomene (stari unos)</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {partsText.map((p, idx) => (
                <li key={idx}>
                  {p.type} ({p.agent}) — ser. {p.serial}: {p.parts}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <p className="text-xs text-gray-500 mt-2">(Ovo je HTML verzija za pregled. PDF generiranje dodamo u sljedećem koraku.)</p>
    </main>
  );
}

