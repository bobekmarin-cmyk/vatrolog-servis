import Link from "next/link";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PrintPageButton from "@/components/PrintPageButton";

export default async function QrLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const extinguisher = await prisma.extinguisher.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true, internalCode: true },
  });
  if (!extinguisher) notFound();

  return (
    <main className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">QR naljepnica</h1>
        <div className="flex gap-2">
          <PrintPageButton label="Ispiši" />
          <Link className="btn btn-outline px-4" href="/extinguishers">
            ← Aparati
          </Link>
        </div>
      </div>

      <section className="surface p-6 text-center print:shadow-none print:border-none">
        <p className="text-sm text-slate-600">Interni broj aparata</p>
        <p className="mt-1 font-mono text-2xl font-bold">{extinguisher.internalCode}</p>
        <div className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white p-3">
          <Image
            src={`/api/extinguishers/${extinguisher.id}/qr`}
            alt={`QR ${extinguisher.internalCode}`}
            width={220}
            height={220}
            unoptimized
          />
        </div>
      </section>
    </main>
  );
}

