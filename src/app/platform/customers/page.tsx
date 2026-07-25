import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function PlatformCustomersPage() {
  await requirePlatformSession();
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, serviceCode: true },
  });
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Kupci (po serviseru)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cross-tenant search po zapisu kupca kod pojedinog servisera (ime, OIB, email, telefon).
          Isti OIB može imati više redova. Read-only — svaki pristup detalju se audit-loga. Za
          portalni pregled po OIB-u koristi Vlasnici (portal).
        </p>
      </div>
      <CustomersClient companies={companies} />
    </main>
  );
}
