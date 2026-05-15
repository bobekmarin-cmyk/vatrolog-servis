import { prisma } from "@/lib/prisma";
import { Section, fmtDateTime } from "./shared";
import DangerConfirmButton from "../DangerConfirmButton";

export default async function DangerZoneTab({ companyId }: { companyId: string }) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      blocked: true,
      deletedAt: true,
      activeUntil: true,
      _count: { select: { accounts: true } },
    },
  });
  if (!company) return null;

  const isSoftDeleted = !!company.deletedAt;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-red-300 bg-red-50 px-5 py-4">
        <h2 className="text-base font-semibold text-red-900">Opasna zona</h2>
        <p className="mt-1 text-sm text-red-800">
          Sve akcije ovdje su nepovratne (ili tesko reverzibilne). Svaka akcija se biljezi u audit
          log s actor-om PLATFORM.
        </p>
      </div>

      <Section title="Force logout svih korisnika tvrtke">
        <p className="text-sm text-slate-600">
          Invalidira sve postojece sesije za {company._count.accounts}{" "}
          {company._count.accounts === 1 ? "racun" : "racuna"}. Korisnici ce se morati ponovo
          prijaviti.
        </p>
        <div className="mt-3">
          <DangerConfirmButton
            action={`/api/platform/companies/${companyId}/force-logout-all`}
            confirmText={`Force logout SVIH (${company._count.accounts}) korisnika tvrtke "${company.name}"?`}
            buttonClass="btn h-9 px-4 text-sm bg-amber-600 text-white hover:bg-amber-700"
            buttonLabel="Force logout svih"
          />
        </div>
      </Section>

      <Section title={isSoftDeleted ? "Vrati tvrtku" : "Soft-delete tvrtke"}>
        {isSoftDeleted ? (
          <>
            <p className="text-sm text-slate-600">
              Tvrtka je soft-deletana {fmtDateTime(company.deletedAt)}. Vracanjem se ponovo
              omogucuje pristup (postavlja se <code>deletedAt = null</code>; <code>blocked</code>{" "}
              ostaje kako jest).
            </p>
            <div className="mt-3">
              <DangerConfirmButton
                action={`/api/platform/companies/${companyId}/restore`}
                confirmText={`Vrati tvrtku "${company.name}" iz soft-delete-a?`}
                buttonClass="btn h-9 px-4 text-sm bg-emerald-600 text-white hover:bg-emerald-700"
                buttonLabel="Vrati tvrtku"
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Postavlja <code>deletedAt = now()</code> i <code>blocked = true</code>. Tvrtka
              nestaje iz svih listi i niti jedan racun se ne moze prijaviti. Reverzibilno preko
              gumba &quot;Vrati&quot; (pojavljuje se nakon soft-delete-a).
            </p>
            <div className="mt-3">
              <DangerConfirmButton
                action={`/api/platform/companies/${companyId}/soft-delete`}
                confirmText={`Soft-delete tvrtke "${company.name}"? Svi racuni ce biti onemoguceni.`}
                buttonClass="btn h-9 px-4 text-sm bg-red-700 text-white hover:bg-red-800"
                buttonLabel="Soft-delete tvrtke"
              />
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
