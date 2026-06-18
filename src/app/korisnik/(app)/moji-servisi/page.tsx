import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getActiveOwnerOrgId } from "@/lib/ownerOrg";
import { getOwnerServicers, type OwnerServicerStatus } from "@/lib/ownerServicers";
import RequestAccessButton from "./RequestAccessButton";

export const dynamic = "force-dynamic";

const STATUS_META: Record<OwnerServicerStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Povezano", className: "bg-emerald-100 text-emerald-800" },
  REQUESTED: { label: "Zahtjev poslan", className: "bg-amber-100 text-amber-800" },
  INVITED: { label: "Pozvani ste", className: "bg-blue-100 text-blue-800" },
  NONE: { label: "Nije povezano", className: "bg-slate-100 text-slate-600" },
  OTHER: { label: "Povezano s drugim računom", className: "bg-slate-100 text-slate-500" },
};

export default async function OwnerServisiPage() {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");
  const ownerOrgId = await getActiveOwnerOrgId(session.ownerId);
  if (!ownerOrgId) redirect("/korisnik/odabir");

  const servicers = await getOwnerServicers(ownerOrgId);
  const activeCount = servicers.filter((s) => s.status === "ACTIVE").length;

  return (
    <>
      <section>
        <h1 className="text-2xl font-bold text-slate-900">Moji servisi</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pregled svih servisa koji servisiraju vaše aparate. Aparate servisa koji nisu povezani
          možete zatražiti — serviser zahtjev mora odobriti prije nego se pojave u portalu.
        </p>
      </section>

      <section className="space-y-3">
        {servicers.map((s) => {
          const meta = STATUS_META[s.status];
          return (
            <div
              key={s.companyId}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-200 hover:shadow sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-slate-900">{s.companyName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {s.apparatusCount} {s.apparatusCount === 1 ? "aparat" : "aparata"} kod ovog servisa
                </div>
              </div>

              <div className="sm:text-right">
                {s.status === "NONE" && s.requestCustomerId ? (
                  <RequestAccessButton customerId={s.requestCustomerId} />
                ) : s.status === "REQUESTED" ? (
                  <span className="text-xs text-slate-500">Čeka odobrenje servisera</span>
                ) : s.status === "ACTIVE" ? (
                  <span className="text-xs text-emerald-700">Vidljivo u portalu</span>
                ) : null}
              </div>
            </div>
          );
        })}

        {servicers.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Još nema povezanih servisa.
          </div>
        )}
      </section>

      {activeCount > 0 && servicers.some((s) => s.status === "NONE") && (
        <p className="text-xs text-slate-500">
          Vidite servis koji vam servisira aparate, a nije povezan? Kliknite „Zatraži pristup” — kad
          ga serviser odobri, njegovi aparati i dokumenti pojavit će se u vašem portalu.
        </p>
      )}
    </>
  );
}
