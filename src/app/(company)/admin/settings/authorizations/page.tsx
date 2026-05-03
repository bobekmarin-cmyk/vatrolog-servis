import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AuthorizationsTable, { type AuthorizationRow } from "./AuthorizationsTable";

export const dynamic = "force-dynamic";

export default async function AuthorizationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const [manufacturers, existing] = await Promise.all([
    prisma.manufacturer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.companyManufacturerAuthorization.findMany({
      where: { companyId: session.companyId },
    }),
  ]);

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

  return (
    <div className="space-y-6">
      <div>
        <div className="h1">Ovlaštenja</div>
        <div className="subtle max-w-3xl">
          Za svakog proizvođača označite ima li servis ovlaštenje, a opcionalno unesite i datum
          isteka. Interne šifre naljepnica (periodični pregled, masa aparata, masa bočice) koriste
          se pri ispisu otpremnice nakon zaključavanja radnog naloga. Promjene se automatski
          spremaju nakon izlaska iz polja.
        </div>
      </div>

      <AuthorizationsTable rows={rows} />
    </div>
  );
}
