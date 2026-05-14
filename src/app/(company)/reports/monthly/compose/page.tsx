import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { customerDisplayName } from "@/lib/customerDisplay";
import { ensureDefaultTemplates } from "@/lib/emailTemplates";
import { countRemainingForCustomer } from "@/lib/monthlyReport";
import { getTenantMailStatus } from "@/lib/tenantMail";
import ComposeForm from "@/components/ComposeForm";
import Link from "next/link";

const MONTH_NAMES = [
  "siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj",
  "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac",
];

export default async function ComposeMailPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; month?: string; type?: string; email?: string; departmentId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const { customerId, month, type, email: emailOverride, departmentId } = sp;

  if (!customerId || !month) redirect("/reports/monthly");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true, name: true, shortName: true, email: true },
  });

  if (!customer) redirect("/reports/monthly");

  const [company, mailStatus] = await Promise.all([
    prisma.company.findUnique({
      where: { id: session.companyId },
      select: { name: true },
    }),
    getTenantMailStatus(session.companyId),
  ]);

  if (!company) redirect("/reports/monthly");
  if (!mailStatus.activeProvider) redirect("/reports/monthly");

  // Resolve "From" prikaz adresa za korisnika.
  let fromAddress = "";
  if (mailStatus.activeProvider === "GMAIL") {
    fromAddress = mailStatus.gmail.email ?? "";
  } else {
    fromAddress = mailStatus.smtp.fromEmail ?? mailStatus.smtp.user ?? "";
  }

  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, (m ?? 1) - 1, 1);
  const to = new Date(y, m ?? 1, 1);
  const monthLabel = `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;

  const itemCount = await countRemainingForCustomer(
    session.companyId,
    customerId,
    departmentId ?? null,
    type === "overdue"
      ? { from, mode: "overdue" }
      : { from, to, mode: "current" },
  );

  const custName = customerDisplayName(customer);
  const isOverdue = type === "overdue";
  const defaultTemplateType = isOverdue ? "AFTER_EXPIRY" : "BEGINNING";

  const allTemplates = await ensureDefaultTemplates(session.companyId);
  // U compose flow-u za mjesečne podsjetnike biramo samo predloške s placeholderom {mjesec}
  // (BEGINNING/BEFORE_EXPIRY/AFTER_EXPIRY); REGISTER/RECEIPT/DELIVERY_NOTE su PDF predlošci
  // za radne naloge i ne pripadaju ovdje.
  const templates = allTemplates.filter((t) =>
    t.type === "BEGINNING" || t.type === "BEFORE_EXPIRY" || t.type === "AFTER_EXPIRY",
  );

  return (
    <main className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/reports/monthly?month=${month}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Sastavljanje maila</h1>
          <p className="text-xs text-slate-400">
            {isOverdue ? "Zaostatak" : "Istek servisa"} — {custName} — {itemCount} aparata
          </p>
        </div>
      </div>

      {!customer.email && !emailOverride ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Kupac nema unesenu email adresu. Dodajte email adresu u profil kupca pa se vratite ovdje.
        </div>
      ) : (
        <ComposeForm
          customerId={customer.id}
          customerEmail={emailOverride || customer.email!}
          month={month}
          itemCount={itemCount}
          companyName={company.name}
          customerName={custName}
          fromAddress={fromAddress}
          monthLabel={monthLabel}
          templates={templates.map((t) => ({
            type: t.type,
            label: t.label,
            subject: t.subject,
            greeting: t.greeting,
            bodyText: t.bodyText,
            calloutText: t.calloutText,
            closingText: t.closingText,
            footerNote: t.footerNote,
          }))}
          defaultTemplateType={defaultTemplateType}
          backUrl={`/reports/monthly?month=${month}`}
        />
      )}
    </main>
  );
}
