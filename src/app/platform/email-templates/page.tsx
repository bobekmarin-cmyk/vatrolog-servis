import Link from "next/link";
import { requirePlatformSession } from "@/lib/platformAuth";
import { resolveAllVendorTemplates } from "@/lib/email/vendorTemplates";

export const dynamic = "force-dynamic";

export default async function PlatformEmailTemplatesPage() {
  await requirePlatformSession();
  const templates = await resolveAllVendorTemplates();
  const overrideCount = templates.filter((t) => t.override !== null).length;

  const dateFmt = new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email predlošci</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sadržaj transakcijskih mailova koji odlaze korisnicima platforme (vendor → tenant).
          Defaultni tekstovi žive u kodu; ovdje pišeš override koji ima prednost. Svaki predložak
          podržava live preview i slanje testnog maila.
        </p>
      </div>

      <section className="surface">
        <div className="surface-header">
          <h2 className="h1">Predlošci</h2>
          <span className="subtle">
            Aktivnih override-a: {overrideCount} / {templates.length}
          </span>
        </div>
        <div className="h-px bg-black/10" />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-600">
                <th className="p-3">Predložak</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Status</th>
                <th className="p-3">Zadnja izmjena</th>
                <th className="p-3 text-right">Akcija</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => (
                <tr key={t.def.type} className="hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-medium text-slate-900">{t.def.label}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{t.def.description}</div>
                  </td>
                  <td className="p-3 text-slate-700">{t.fields.subject}</td>
                  <td className="p-3">
                    {t.override ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                        Override aktivan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-slate-600">
                    {t.override?.updatedAt ? dateFmt.format(t.override.updatedAt) : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      className="btn btn-outline h-8 px-3 text-xs"
                      href={`/platform/email-templates/${encodeURIComponent(t.def.type)}`}
                    >
                      Uredi
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
