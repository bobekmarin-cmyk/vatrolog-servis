import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import EmailLogClient from "./EmailLogClient";

export const dynamic = "force-dynamic";

export default async function PlatformEmailLogPage() {
  await requirePlatformSession();
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, serviceCode: true },
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email log</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cross-tenant pregled svih poslanih mailova (sistemski + tenant Gmail + SMTP).
        </p>
      </div>
      <EmailLogClient companies={companies} />
    </main>
  );
}
