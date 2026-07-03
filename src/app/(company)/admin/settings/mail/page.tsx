import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import MailIntegrationsSection from "@/components/MailIntegrationsSection";
import EmailTemplatesSettings from "@/components/EmailTemplatesSettings";
import { ensureDefaultTemplates } from "@/lib/emailTemplates";
import { getTenantMailStatus } from "@/lib/tenantMail";
import { companyPlanAllows, planUpgradeMessage } from "@/lib/subscriptionPlan";

export default async function MailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const mailAllowed = await companyPlanAllows(session.companyId, "MAIL_SENDING");
  if (!mailAllowed) {
    return (
      <div className="w-full space-y-6">
        <section className="space-y-3">
          <div>
            <h2 className="h1">Slanje obavijesti kupcima</h2>
            <p className="subtle mt-1">
              Slanje primki, upisnika, otpremnica i automatskih obavijesti kupcima mailom.
            </p>
          </div>
          <div className="surface max-w-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">{planUpgradeMessage("MAIL_SENDING")}</p>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 whitespace-nowrap">
                Standard plan
              </span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const sp = await searchParams;
  const gmailStatus = sp.gmail ?? null;
  const gmailReason = sp.reason ?? null;

  const [mailStatus, templates] = await Promise.all([
    getTenantMailStatus(session.companyId),
    ensureDefaultTemplates(session.companyId),
  ]);

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

      <section className="space-y-3">
        <div>
          <h2 className="h1">Slanje obavijesti kupcima</h2>
          <p className="subtle mt-1">
            Povežite Gmail račun ili konfigurirajte vlastiti SMTP server (npr. <span className="font-medium">info@moj-servis.hr</span>) za slanje obavijesti kupcima o isteku servisa, upisnika i izvještaja.
          </p>
        </div>
        <MailIntegrationsSection initial={mailStatus} />
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-8">
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
  );
}
