import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { customerDisplayName } from "@/lib/customerDisplay";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/?forbidden=1");

  const { id } = await params;

  // Detail prikazuje samo mail kupcima — sistemska pošta (customerId=null)
  // ide adminu i nije relevantna na tenant strani.
  const log = await prisma.emailLog.findFirst({
    where: { id, companyId: session.companyId, customerId: { not: null } },
    include: { customer: true },
  });

  if (!log) redirect("/reports/email-log");

  const custName = customerDisplayName(log.customer);

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      {/* Zaglavlje */}
      <div className="flex items-center gap-3">
        <Link
          href="/reports/email-log"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pregled poslanog maila</h1>
          <p className="text-xs text-slate-400">
            {custName} — {formatDateDdMmYyyy(log.sentAt)}
          </p>
        </div>
      </div>

      {/* Okvir maila */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        {/* Zaglavlje maila */}
        <div className="divide-y divide-slate-100 border-b border-slate-100 text-sm">
          <div className="flex items-center gap-0 px-4 py-1.5">
            <span className="w-16 shrink-0 text-xs font-medium text-slate-400">Prima</span>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {custName}
                <span className="text-blue-400">&lt;{log.toEmail}&gt;</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-0 px-4 py-1.5">
            <span className="w-16 shrink-0 text-xs font-medium text-slate-400">Predmet</span>
            <span className="text-sm text-slate-800">{log.subject}</span>
          </div>
          <div className="flex items-center gap-0 px-4 py-1.5">
            <span className="w-16 shrink-0 text-xs font-medium text-slate-400">Datum</span>
            <span className="text-xs text-slate-600">{formatDateDdMmYyyy(log.sentAt)}</span>
            <span className="ml-3 text-xs text-slate-400">
              {log.sentAt.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="flex items-center gap-0 px-4 py-1.5">
            <span className="w-16 shrink-0 text-xs font-medium text-slate-400">Status</span>
            {log.status === "SENT" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                Poslano
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                Greška
              </span>
            )}
            {log.error && (
              <span className="ml-2 text-xs text-red-500">{log.error}</span>
            )}
          </div>
        </div>

        {/* Tijelo maila */}
        {log.htmlBody ? (
          <div className="p-6">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: log.htmlBody }}
            />
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            Sadržaj maila nije pohranjen za ovu poruku.
          </div>
        )}
      </div>

      {/* Dodatne informacije */}
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2 text-xs text-slate-400">
        <span>Mjesec: {log.month} · Aparata: {log.itemCount}</span>
        <span>ID: {log.id}</span>
      </div>
    </main>
  );
}
