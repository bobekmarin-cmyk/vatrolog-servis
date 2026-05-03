import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ReceiptForm from "./ReceiptForm";

export const dynamic = "force-dynamic";

export default async function NewReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ partId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { partId } = await searchParams;

  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      parts: {
        where: {
          active: true,
          OR: [{ companyId: null }, { companyId: session.companyId }],
          NOT: { stocks: { some: { companyId: session.companyId, hidden: true } } },
        },
        orderBy: [{ name: "asc" }, { code: "asc" }],
        select: { id: true, code: true, name: true },
      },
    },
  });

  const prefillPart = partId
    ? await prisma.part.findUnique({
        where: { id: partId },
        select: { id: true, manufacturerId: true },
      })
    : null;

  return (
    <main className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          <Link href="/warehouse/parts" className="hover:underline">
            Skladište dijelova
          </Link>{" "}
          /{" "}
          <Link href="/warehouse/receipts" className="hover:underline">
            Primke
          </Link>{" "}
          / Nova
        </div>
        <h1 className="text-3xl font-bold">Nova skladišna primka</h1>
        <p className="mt-1 text-sm text-slate-600">
          Unesite podatke o dobavljaču i stavke primljenih dijelova. Spremanjem se automatski ažurira
          stanje u skladištu.
        </p>
      </div>

      <ReceiptForm
        manufacturers={manufacturers}
        prefillManufacturerId={prefillPart?.manufacturerId ?? null}
        prefillPartId={prefillPart?.id ?? null}
      />
    </main>
  );
}
