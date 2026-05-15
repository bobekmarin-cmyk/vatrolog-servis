import { prisma } from "@/lib/prisma";
import PlatformSubscriptionManager from "@/components/PlatformSubscriptionManager";
import PlatformFeatureToggles from "@/components/PlatformFeatureToggles";
import { getCompanyFeatures } from "@/lib/companyFeatures";
import { Section, fmtDateTime } from "./shared";

export default async function SettingsTab({ companyId }: { companyId: string }) {
  const [company, features, lastSubAudit] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        activeUntil: true,
        blocked: true,
        stripeCustomerId: true,
        trialEndsAt: true,
      },
    }),
    getCompanyFeatures(companyId),
    prisma.auditLog.findFirst({
      where: {
        companyId,
        action: { in: ["subscription.updated", "subscription.created", "subscription.canceled"] },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, action: true, meta: true },
    }),
  ]);

  if (!company) return null;

  return (
    <div className="space-y-4">
      <Section title="Pretplata i pristup">
        <PlatformSubscriptionManager
          companyId={company.id}
          activeUntil={company.activeUntil?.toISOString() ?? null}
          blocked={company.blocked}
        />
      </Section>

      <Section title="Stripe / Billing">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
          <div>
            <dt className="font-medium text-slate-500">Stripe customer ID</dt>
            <dd className="font-mono text-xs">
              {company.stripeCustomerId ?? <span className="text-slate-400">— (nije povezan)</span>}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Trial istice</dt>
            <dd className="text-xs">
              {company.trialEndsAt ? fmtDateTime(company.trialEndsAt) : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Zadnji subscription audit</dt>
            <dd className="text-xs">
              {lastSubAudit ? (
                <span>
                  <span className="font-mono">{lastSubAudit.action}</span> ·{" "}
                  {fmtDateTime(lastSubAudit.createdAt)}
                </span>
              ) : (
                <span className="text-slate-400">— (nije bilo events-a)</span>
              )}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Moduli">
        <p className="mb-3 text-sm text-slate-600">
          Odaberi koje module zelis omoguciti za Admin i Workshop korisnike ove tvrtke.
        </p>
        <PlatformFeatureToggles companyId={company.id} features={features} />
      </Section>
    </div>
  );
}
