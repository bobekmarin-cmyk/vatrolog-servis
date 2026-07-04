import { prisma } from "@/lib/prisma";
import { Section, fmtDateTime } from "./shared";
import DangerConfirmButton from "../DangerConfirmButton";
import ForceUnlockOrderForm from "../ForceUnlockOrderForm";

const FORCE_UNLOCK_FLASH: Record<string, { tone: "ok" | "err"; text: string }> = {
  ok: {
    tone: "ok",
    text: "Nalog je otključan. Naljepnice i skladište NISU dirani — kod ponovnog zaključavanja obračunava se samo razlika.",
  },
  missing: { tone: "err", text: "Upišite broj naloga." },
  not_found: { tone: "err", text: "Nalog s tim brojem nije pronađen za ovu tvrtku." },
  not_locked: { tone: "err", text: "Nalog nije zaključan pa nema što otključati." },
};

export default async function DangerZoneTab({
  companyId,
  forceUnlockFlash,
}: {
  companyId: string;
  forceUnlockFlash?: string | null;
}) {
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

      <Section title="Prisilno otključavanje naloga">
        <p className="text-sm text-slate-600">
          Zaključani nalog za koji postoji račun u e-računima (koncept ili izdan) tenant vise ne
          moze otkljucati sam — otkljucavanje je rezervirano za vendora u iznimnim slucajevima.
          Nalog se SAMO otkljuca (korisnik doradi i ponovo zakljuca); naljepnice i skladiste se ne
          diraju, a kod ponovnog zakljucavanja obracunava se samo razlika. Eventualni racun u
          e-racunima treba uskladiti rucno.
        </p>
        {forceUnlockFlash && FORCE_UNLOCK_FLASH[forceUnlockFlash] ? (
          <p
            className={`mt-2 rounded-md px-3 py-2 text-sm ${
              FORCE_UNLOCK_FLASH[forceUnlockFlash].tone === "ok"
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                : "bg-red-50 text-red-800 ring-1 ring-red-200"
            }`}
          >
            {FORCE_UNLOCK_FLASH[forceUnlockFlash].text}
          </p>
        ) : null}
        <div className="mt-3">
          <ForceUnlockOrderForm companyId={companyId} />
        </div>
      </Section>

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
