import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import { getVendorStatus } from "@/lib/platformGmail";
import { resolveVendorAlertInbox } from "@/lib/registrationAlert";
import ApproveRequestForm from "./ApproveRequestForm";
import RejectRequestForm from "./RejectRequestForm";
import ResendActions from "./ResendActions";

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Na pregledu", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  APPROVED: {
    label: "Odobreno (čeka kreaciju)",
    tone: "bg-blue-50 text-blue-800 border-blue-200",
  },
  REJECTED: { label: "Odbijeno", tone: "bg-rose-50 text-rose-800 border-rose-200" },
  CONVERTED: {
    label: "Odobreno",
    tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
};

export const dynamic = "force-dynamic";

export default async function RegistrationRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformSession();
  const { id } = await params;

  const reg = await prisma.registrationRequest.findUnique({
    where: { id },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          serviceCode: true,
          usernameSlug: true,
          createdAt: true,
        },
      },
    },
  });
  if (!reg) notFound();

  const status = STATUS_LABEL[reg.status] ?? {
    label: reg.status,
    tone: "bg-slate-50 text-slate-700 border-slate-200",
  };
  const canDecide = reg.status === "PENDING";

  const vendorInbox = resolveVendorAlertInbox();
  const vendorGmail = await getVendorStatus().catch(() => ({
    connected: false,
    email: null,
    connectedAt: null,
    expiresAt: null,
    scope: null,
  }));
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
  const transportReady = vendorGmail.connected || smtpConfigured;

  // Admin AccountUser ID za "Pošalji onboarding pozivnicu ponovno" (CONVERTED + ima company).
  const adminAccount = reg.company
    ? await prisma.accountUser.findFirst({
        where: { companyId: reg.company.id, role: "ADMIN" },
        select: { id: true, email: true, username: true },
      })
    : null;

  // Povijest mailova vezanih uz ovaj zahtjev.
  const emailLogWhere = reg.companyId
    ? { companyId: reg.companyId }
    : {
        toEmail: {
          in: [reg.contactEmail, vendorInbox].filter(
            (v): v is string => typeof v === "string" && v.length > 0,
          ),
        },
      };
  const emailLog = await prisma.emailLog.findMany({
    where: emailLogWhere,
    orderBy: { sentAt: "desc" },
    take: 20,
    select: {
      id: true,
      sentAt: true,
      toEmail: true,
      subject: true,
      kind: true,
      transport: true,
      status: true,
      error: true,
      messageId: true,
    },
  });

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/platform/registration-requests"
            className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
          >
            ← Svi zahtjevi
          </Link>
          <h1 className="text-3xl font-bold">{reg.companyName}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${status.tone}`}
            >
              {status.label}
            </span>
            <span>Zaprimljen {fmtDate(reg.createdAt)}</span>
          </div>
        </div>
      </div>

      {!transportReady && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Email transport nije konfiguriran</div>
          <p className="mt-1">
            Vendor Gmail nije spojen, a SMTP fallback nije postavljen. Mailovi se
            spremaju u <code>EmailLog</code> kao <code>DEV_LOG</code> i ne šalju
            se stvarno.
          </p>
          <p className="mt-2">
            Otvori{" "}
            <Link
              href="/platform/settings?tab=email"
              className="font-semibold underline"
            >
              Postavke → Email integracija
            </Link>{" "}
            i klikni „Poveži Gmail“.
          </p>
        </section>
      )}

      <section className="surface p-4 space-y-3">
        <h2 className="h1">Podaci podnositelja</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field label="Naziv subjekta" value={reg.companyName} />
          <Field label="OIB / matični broj" value={reg.oib} mono />
          <Field
            label="Adresa"
            value={`${reg.street}, ${reg.postalCode} ${reg.city}`}
          />
          <Field label="Kontakt e-mail" value={reg.contactEmail} mono />
          {reg.contactName && <Field label="Kontakt osoba" value={reg.contactName} />}
          {reg.contactPhone && (
            <Field label="Kontakt telefon" value={reg.contactPhone} />
          )}
        </dl>
        {reg.note && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Napomena podnositelja
            </div>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">{reg.note}</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 text-xs text-slate-500 sm:grid-cols-2">
          {reg.ip && <Field label="IP" value={reg.ip} small mono />}
          {reg.userAgent && <Field label="User-Agent" value={reg.userAgent} small mono />}
        </div>
      </section>

      <section className="surface p-4 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="h1">Mailovi</h2>
          <span className="text-xs text-slate-500">
            Vendor inbox: <code>{vendorInbox ?? "(nije postavljen)"}</code>
            {vendorGmail.connected && vendorGmail.email
              ? ` · transport: Vendor Gmail (${vendorGmail.email})`
              : smtpConfigured
              ? " · transport: SMTP"
              : " · transport: dev log"}
          </span>
        </div>
        <ResendActions
          requestId={reg.id}
          status={reg.status}
          contactEmail={reg.contactEmail}
          vendorInbox={vendorInbox}
          companyId={reg.company?.id ?? null}
          adminAccountId={adminAccount?.id ?? null}
          adminAccountEmail={adminAccount?.email ?? null}
        />

        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="text-left">
                <th className="p-2">Vrijeme</th>
                <th className="p-2">Primatelj</th>
                <th className="p-2">Vrsta</th>
                <th className="p-2">Transport</th>
                <th className="p-2">Status</th>
                <th className="p-2">Subject / greška</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {emailLog.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="p-2 text-slate-600">{fmtDate(row.sentAt)}</td>
                  <td className="p-2 font-mono text-[11px] text-slate-700">
                    {row.toEmail}
                  </td>
                  <td className="p-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                      {row.kind}
                    </span>
                  </td>
                  <td className="p-2 text-slate-700">{row.transport ?? "—"}</td>
                  <td className="p-2">
                    {row.status === "SENT" ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        SENT
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                        FAILED
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="text-slate-800">{row.subject}</div>
                    {row.error && (
                      <div className="mt-0.5 text-rose-700">{row.error}</div>
                    )}
                  </td>
                </tr>
              ))}
              {emailLog.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    Nema zapisa. Pošalji potvrdu/alert/pozivnicu pa će se ovdje
                    pojaviti povijest.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {reg.status === "REJECTED" && (
        <section className="surface p-4 space-y-2">
          <h2 className="h1">Odbijeno</h2>
          <Field
            label="Datum odbijanja"
            value={fmtDate(reg.rejectedAt)}
            small
          />
          <Field
            label="Razlog"
            value={reg.rejectedReason || "(nije upisan)"}
            small
          />
        </section>
      )}

      {(reg.status === "APPROVED" || reg.status === "CONVERTED") && reg.company && (
        <section className="surface p-4 space-y-2">
          <h2 className="h1">Kreirana tvrtka</h2>
          <Field label="Naziv" value={reg.company.name} small />
          <Field label="Šifra servisa" value={reg.company.serviceCode} small mono />
          <Field label="Username slug" value={reg.company.usernameSlug} small mono />
          <Field
            label="Kreirano"
            value={fmtDate(reg.company.createdAt)}
            small
          />
          {reg.approvalNote && <Field label="Bilješka" value={reg.approvalNote} small />}
          <div className="pt-2">
            <Link
              href={`/platform/companies/${reg.company.id}`}
              className="btn btn-outline px-3 text-xs"
            >
              Otvori tvrtku
            </Link>
          </div>
        </section>
      )}

      {canDecide && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
            <header className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Odobri i kreiraj tvrtku</h2>
              <p className="text-sm text-slate-600">
                Po odobrenju kreiramo Company, neaktivni ADMIN i WORKSHOP račune,
                servisne lokacije i katalog. Onboarding pozivnica se šalje na e-mail
                admina; korisnik sam postavlja lozinke i tek time aktivira 30-dnevni
                probni rad.
              </p>
            </header>
            <ApproveRequestForm
              requestId={reg.id}
              defaultCompanyName={reg.companyName}
              defaultAdminEmail={reg.contactEmail}
              defaultStreet={reg.street}
              defaultCity={reg.city}
              defaultPostalCode={reg.postalCode}
              defaultOib={reg.oib}
            />
          </section>

          <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 space-y-3">
            <header className="space-y-1">
              <h2 className="text-xl font-bold text-rose-800">Odbij zahtjev</h2>
              <p className="text-sm text-rose-700">
                Pošaljemo pristojan e-mail s razlogom (ako ga upišeš). Zahtjev se
                označava kao odbijen i ne kreiraju se nikakvi podaci.
              </p>
            </header>
            <RejectRequestForm requestId={reg.id} />
          </section>
        </>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <dt
        className={`font-semibold uppercase tracking-wide text-slate-500 ${small ? "text-[10px]" : "text-xs"}`}
      >
        {label}
      </dt>
      <dd
        className={`${small ? "text-xs" : "text-sm"} ${mono ? "font-mono break-all" : ""} text-slate-800`}
      >
        {value}
      </dd>
    </div>
  );
}
