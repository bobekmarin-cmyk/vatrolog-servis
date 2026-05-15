import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AuthorizationsClient, {
  type AuthorizationRow,
  type SharedCodes,
} from "./AuthorizationsClient";

export const dynamic = "force-dynamic";

export default async function AuthorizationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const [company, manufacturers, existing] = await Promise.all([
    prisma.company.findUnique({
      where: { id: session.companyId },
      select: {
        labelCodeStrategy: true,
        sharedPeriodicLabelCode: true,
        sharedApparatusMassLabelCode: true,
        sharedCylinderMassLabelCode: true,
      },
    }),
    prisma.manufacturer.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.companyManufacturerAuthorization.findMany({
      where: { companyId: session.companyId },
    }),
  ]);

  if (!company) redirect("/");

  const byManuId = new Map(existing.map((a) => [a.manufacturerId, a]));

  const rows: AuthorizationRow[] = manufacturers.map((m) => {
    const a = byManuId.get(m.id) ?? null;
    return {
      manufacturerId: m.id,
      manufacturerName: m.name,
      active: a?.active ?? false,
      expiresAt: a?.expiresAt ? a.expiresAt.toISOString().slice(0, 10) : "",
      periodicLabelCode: a?.periodicLabelCode ?? "",
      apparatusMassLabelCode: a?.apparatusMassLabelCode ?? "",
      cylinderMassLabelCode: a?.cylinderMassLabelCode ?? "",
    };
  });

  const sharedCodes: SharedCodes = {
    periodicLabelCode: company.sharedPeriodicLabelCode ?? "",
    apparatusMassLabelCode: company.sharedApparatusMassLabelCode ?? "",
    cylinderMassLabelCode: company.sharedCylinderMassLabelCode ?? "",
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="h1">Ovlaštenja</div>
        <div className="subtle max-w-3xl">
          Za svakog proizvođača označite ima li servis ovlaštenje, a opcionalno unesite i datum
          isteka. Interne šifre naljepnica (periodični pregled, masa aparata, masa bočice) koriste
          se pri ispisu otpremnice nakon zaključavanja radnog naloga.
        </div>
      </div>

      <AuthorizationsClient
        initialStrategy={company.labelCodeStrategy}
        initialSharedCodes={sharedCodes}
        rows={rows}
      />
    </div>
  );
}
