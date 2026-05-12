import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { FEATURE_KEYS, getCompanyFeatures, isFeatureEnabledForRole } from "@/lib/companyFeatures";
import { redirect } from "next/navigation";
import BatchSendButton from "@/components/BatchSendButton";
import MonthlyReportTables, { type CustRow } from "@/components/MonthlyReportTables";
import { buildMonthData } from "@/lib/monthlyReport";
import { getTenantMailStatus } from "@/lib/tenantMail";

function startOfMonthFromYm(ym: string) {
  const [y, m] = ym.split("-").map((x) => Number(x));
  return new Date(y, m - 1, 1);
}
function startOfNextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function ymOf(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const MONTH_NAMES = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; sent?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const features = await getCompanyFeatures(session.companyId);
  const allowed = isFeatureEnabledForRole(session.role, features, FEATURE_KEYS.REPORTS_MONTHLY);
  if (!allowed) redirect("/?forbidden=1");

  const sp = await searchParams;
  const now = new Date();
  const month = sp.month ?? ymOf(now);
  const from = startOfMonthFromYm(month);
  const to = startOfNextMonth(from);
  const showSentBanner = sp.sent === "1";

  const [dueData, overdueData, mailStatus, emailLogs] = await Promise.all([
    buildMonthData(session.companyId, { from, to, mode: "current" }),
    buildMonthData(session.companyId, { from, mode: "overdue" }),
    getTenantMailStatus(session.companyId),
    prisma.emailLog.findMany({
      where: { companyId: session.companyId, month, status: "SENT" },
      orderBy: { sentAt: "desc" },
      select: { customerId: true, sentAt: true },
    }),
  ]);

  const mailConnected = !!mailStatus.activeProvider;

  const sentEntries = emailLogs
    .filter((l): l is { customerId: string; sentAt: Date } => l.customerId !== null)
    .map((l) => ({
      customerId: l.customerId,
      sentAt: l.sentAt.toISOString(),
    }));

  const allCustomers = [...dueData.rows, ...overdueData.rows];
  const uniqueAutoNotify = new Map<string, CustRow>();
  for (const c of allCustomers) {
    const uniqueKey = c.departmentId ? `${c.id}::${c.departmentId}` : c.id;
    const remaining = c.totalDue - c.alreadyServiced;
    if (
      c.autoNotify &&
      c.email &&
      mailConnected &&
      remaining > 0 &&
      !uniqueAutoNotify.has(uniqueKey)
    ) {
      uniqueAutoNotify.set(uniqueKey, c);
    }
  }
  const batchEligible = Array.from(uniqueAutoNotify.values()).map((c) => {
    const isDue = dueData.rows.some((r) => r.id === c.id && r.departmentId === c.departmentId);
    return { ...c, type: (isDue ? "due" : "overdue") as "due" | "overdue" };
  });

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plan servisa</h1>
          <p className="text-sm text-slate-500">{monthLabel(month)}</p>
        </div>
        <Link className="btn btn-outline px-4" href="/dashboard">← Dashboard</Link>
      </div>

      {showSentBanner && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Mail je uspješno poslan!
        </div>
      )}

      {/* Month picker + KPI */}
      <section className="surface p-4">
        <form className="flex flex-wrap items-end gap-3" action="/reports/monthly" method="get">
          <div>
            <label className="label">Odaberi mjesec</label>
            <input type="month" name="month" className="input" defaultValue={month} required />
          </div>
          <button className="btn btn-primary px-4" type="submit">Prikaži</button>
        </form>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="surface p-4 text-center">
            <div className="text-xs text-slate-500">Ističe ovaj mjesec</div>
            <div className="text-2xl font-bold tabular-nums text-amber-700">{dueData.totalItems}</div>
          </div>
          <div className="surface p-4 text-center">
            <div className="text-xs text-slate-500">Zaostaci (isteklo ranije)</div>
            <div className="text-2xl font-bold tabular-nums text-red-700">{overdueData.totalItems}</div>
          </div>
        </div>
      </section>

      {!mailConnected && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Mail nije konfiguriran — <Link href="/admin/settings/mail" className="underline font-medium">povežite Gmail ili SMTP u postavkama</Link> za slanje obavijesti.
        </div>
      )}

      {/* Batch send */}
      {mailConnected && batchEligible.length > 0 && (
        <section className="surface p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Automatske obavijesti</div>
              <div className="text-xs text-slate-500">
                {batchEligible.length} kupaca s uključenim automatskim obavještavanjem
              </div>
            </div>
            <BatchSendButton
              month={month}
              customers={batchEligible.map((c) => ({
                id: c.id,
                name: c.name,
                email: c.email!,
                count: Math.max(0, c.totalDue - c.alreadyServiced),
                type: c.type,
              }))}
            />
          </div>
        </section>
      )}

      {/* Tables */}
      <MonthlyReportTables
        month={month}
        customersDue={dueData.rows}
        customersOverdue={overdueData.rows}
        totalDueItems={dueData.totalItems}
        totalOverdueItems={overdueData.totalItems}
        mailConnected={mailConnected}
        sentEntries={sentEntries}
      />
    </main>
  );
}
