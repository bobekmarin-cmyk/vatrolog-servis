import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ERacuniSettingsSection from "@/components/ERacuniSettingsSection";

export default async function IntegrationsSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

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
