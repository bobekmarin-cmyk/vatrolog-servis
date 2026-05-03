import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GmailConnectSection from "@/components/GmailConnectSection";
import EmailTemplatesSettings from "@/components/EmailTemplatesSettings";
import { ensureDefaultTemplates } from "@/lib/emailTemplates";

export default async function MailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const gmailStatus = sp.gmail ?? null;
  const gmailReason = sp.reason ?? null;

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: {
      gmailEmail: true,
      gmailConnectedAt: true,
    },
  });
  if (!company) redirect("/");

  const templates = await ensureDefaultTemplates(session.companyId);

  return (
    <div className="w-full space-y-6">
      {gmailStatus === "connected" && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Gmail račun uspješno povezan!
        </div>
      )}
      {gmailStatus === "error" && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          Greška pri povezivanju Gmaila{gmailReason ? `: ${gmailReason}` : ""}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start md:gap-10">
        <section className="min-w-0 space-y-3">
          <div>
            <h2 className="h1">Gmail integracija</h2>
            <p className="subtle mt-1">
              Povežite Gmail račun za slanje obavijesti kupcima o isteku servisa.
            </p>
          </div>
          <GmailConnectSection
            connected={!!company.gmailEmail}
            email={company.gmailEmail}
            connectedAt={company.gmailConnectedAt?.toISOString() ?? null}
          />
        </section>

        <section className="min-w-0 space-y-3 border-t border-slate-200 pt-8 md:border-t-0 md:border-l md:pt-0 md:pl-10">
          <div>
            <h2 className="h1">Predlošci obavijesti</h2>
            <p className="subtle mt-1">
              Tekstovi koje sustav šalje kupcima. Uređivanje otvorite tek kad treba.
            </p>
          </div>
          <EmailTemplatesSettings
            templates={templates.map((t) => ({
              id: t.id,
              type: t.type,
              label: t.label,
              subject: t.subject,
              greeting: t.greeting,
              bodyText: t.bodyText,
              calloutText: t.calloutText,
              closingText: t.closingText,
              footerNote: t.footerNote,
            }))}
          />
        </section>
      </div>
    </div>
  );
}
