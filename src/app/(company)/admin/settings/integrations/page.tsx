import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ERacuniSettingsSection from "@/components/ERacuniSettingsSection";
import { companyPlanAllows, planUpgradeMessage } from "@/lib/subscriptionPlan";

export default async function IntegrationsSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const invoicingAllowed = await companyPlanAllows(session.companyId, "INVOICING_INTEGRATIONS");
  if (!invoicingAllowed) {
    return (
      <div className="w-full space-y-6">
        <section className="space-y-3">
          <div>
            <h2 className="h1">e-računi</h2>
            <p className="subtle mt-1">
              Povezivanje s <span className="font-medium">e-racuni.com</span> programom za fakturiranje —
              automatsko kreiranje računa iz zaključanih radnih naloga.
            </p>
          </div>
          <div className="surface max-w-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">{planUpgradeMessage("INVOICING_INTEGRATIONS")}</p>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 whitespace-nowrap">
                Premium plan
              </span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const settings = await prisma.companyERacuniSettings.findUnique({
    where: { companyId: session.companyId },
  });

  return (
    <div className="w-full space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="h1">e-računi</h2>
          <p className="subtle mt-1">
            Povezivanje s <span className="font-medium">e-racuni.com</span> programom za fakturiranje.
            Iz zaključanog radnog naloga jednim klikom kreirate koncept računa sa svim uslugama,
            naljepnicama i dijelovima. Cijene se čitaju iz VatroLog šifrarnika, a rabati iz postavki kupca.
          </p>
        </div>
        <ERacuniSettingsSection
          initial={{
            enabled: settings?.enabled ?? false,
            apiUsername: settings?.apiUsername ?? "",
            hasPassword: !!settings?.apiPasswordEnc,
            hasToken: !!settings?.apiTokenEnc,
            paymentMethod: settings?.paymentMethod ?? "bankTransfer",
            paymentDueDays: settings?.paymentDueDays ?? 15,
            labelKompletCode: settings?.labelKompletCode ?? "",
            labelKompletName: settings?.labelKompletName ?? "Komplet naljepnica",
            labelKompletPrice:
              settings?.labelKompletPrice != null ? String(settings.labelKompletPrice) : "",
            lastTestOkAt: settings?.lastTestOkAt?.toISOString() ?? null,
          }}
        />
      </section>
    </div>
  );
}
