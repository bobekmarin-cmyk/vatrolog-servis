import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import QrLabelGeneratorForm from "./QrLabelGeneratorForm";

export const dynamic = "force-dynamic";

export default async function QrLabelsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { name: true, serviceCode: true },
  });
  if (!company) redirect("/api/auth/logout");

  return (
    <main className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">QR naljepnice</h1>
        <p className="mt-1 text-sm text-slate-600">
          Isprintajte arak QR naljepnica unaprijed i nalijepite na aparate — kod se dodjeljuje pri prvom servisu.
        </p>
      </div>

      <QrLabelGeneratorForm serviceCode={company.serviceCode} servicerName={company.name} />
    </main>
  );
}
