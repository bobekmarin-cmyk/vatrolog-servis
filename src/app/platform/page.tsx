import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";

/** Bez DB na buildu — ne pokušavaj statički prerender (npr. Railway/CI bez DATABASE_URL). */
export const dynamic = "force-dynamic";

export default async function PlatformIndexPage() {
  await requirePlatformSession();

  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalCompanies,
    activeCompanies,
    trialCompanies,
    expiringSoon,
    signupsThisMonth,
    emailFailures,
    pendingRequests,
  ] = await Promise.all([
    prisma.company.count({ where: { deletedAt: null } }),
    prisma.company.count({
      where: {
        deletedAt: null,
        blocked: false,
        OR: [{ activeUntil: null }, { activeUntil: { gte: now } }],
      },
    }),
    prisma.company.count({
      where: {
        deletedAt: null,
        trialEndsAt: { not: null, gte: now },
      },
    }),
    prisma.company.count({
      where: {
        deletedAt: null,
        blocked: false,
        activeUntil: { not: null, gte: now, lte: inSevenDays },
      },
    }),
    prisma.company.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } }),
    prisma.emailLog.count({ where: { status: "FAILED", sentAt: { gte: monthStart } } }),
    prisma.registrationRequest.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Platform dashboard</h1>
          <p className="text-sm text-slate-600">Brzi pregled SaaS operacija prije i nakon launch-a.</p>
        </div>
        <Link href="/platform/companies" className="btn btn-primary">
          Upravljaj tvrtkama
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Link href="/platform/registration-requests?status=PENDING" className="block">
          <Metric
            label="Zahtjevi za pregled"
            value={pendingRequests}
            tone={pendingRequests > 0 ? "warning" : "success"}
          />
        </Link>
        <Metric label="Tvrtke" value={totalCompanies} />
        <Metric label="Aktivne" value={activeCompanies} tone="success" />
        <Metric label="Trial" value={trialCompanies} tone="info" />
        <Metric
          label="Ističe u 7 dana"
          value={expiringSoon}
          tone={expiringSoon > 0 ? "warning" : "success"}
        />
        <Metric label="Signup ovaj mjesec" value={signupsThisMonth} />
        <Metric
          label="Email greške / mjesec"
          value={emailFailures}
          tone={emailFailures > 0 ? "danger" : "success"}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">Operativni fokus</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {pendingRequests > 0 && (
            <li>
              <Link
                href="/platform/registration-requests?status=PENDING"
                className="font-semibold text-amber-700 hover:underline"
              >
                {pendingRequests} {pendingRequests === 1 ? "zahtjev čeka" : "zahtjeva čekaju"} pregled.
              </Link>
            </li>
          )}
          <li>Provjeri tvrtke kojima pretplata ističe u idućih 7 dana.</li>
          <li>Pregledaj email greške i potvrdi da vendor Gmail ili SMTP rade.</li>
          <li>Prati nove trial registracije i kontaktiraj ih tijekom prvog dana korištenja.</li>
        </ul>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "danger"
          ? "border-red-200 bg-red-50 text-red-800"
          : tone === "info"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-slate-200 bg-white text-slate-800";

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

