import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import AuditClient from "./AuditClient";

export const dynamic = "force-dynamic";

export default async function PlatformAuditPage() {
  await requirePlatformSession();

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, serviceCode: true },
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit log</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cross-tenant pregled svih audit zapisa (tenant + platform akcije).
        </p>
      </div>
      <AuditClient companies={companies} />
    </main>
  );
}
