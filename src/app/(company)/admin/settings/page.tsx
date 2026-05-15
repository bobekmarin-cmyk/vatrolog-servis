import { getSession } from "@/lib/auth";
import { FEATURE_KEYS, getCompanyFeatures, isFeatureEnabledForRole } from "@/lib/companyFeatures";
import CompanySettingsForm from "@/components/CompanySettingsForm";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const features = await getCompanyFeatures(session.companyId);
  const allowed = isFeatureEnabledForRole(session.role, features, FEATURE_KEYS.ADMIN_SETTINGS);
  if (!allowed) redirect("/?forbidden=1");

  const sp = await searchParams;
  const showSetupBanner = String(sp.setup ?? "").trim() === "1";

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: {
      oib: true,
      name: true,
      street: true,
      city: true,
      postalCode: true,
      iban: true,
      email: true,
      phone: true,
      deliveryNoteNumberPrefix: true,
    },
  });
  if (!company) redirect("/");

  return (
    <div className="w-full space-y-4">
      {showSetupBanner ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Za nastavak korištenja potrebno je unijeti obavezne podatke: <b>IBAN</b>, <b>e-mail</b> i{" "}
          <b>kontakt broj</b>.
        </div>
      ) : null}

      <div>
        <div className="h1">Postavke tvrtke</div>
        <div className="subtle">Naziv i OIB su samo za čitanje. Adresu možeš mijenjati.</div>
      </div>

      <CompanySettingsForm
        oib={company.oib}
        name={company.name}
        street={company.street}
        city={company.city}
        postalCode={company.postalCode}
        iban={company.iban ?? ""}
        email={company.email ?? ""}
        phone={company.phone ?? ""}
        deliveryNoteNumberPrefix={company.deliveryNoteNumberPrefix}
      />
    </div>
  );
}
