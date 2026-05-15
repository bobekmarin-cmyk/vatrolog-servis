import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import LabelReceiptForm, { type LabelManufacturer } from "./LabelReceiptForm";
import type { ServiceLabelKind } from "@prisma/client";
import { serviceLabelKindLabel } from "@/lib/serviceLabelKind";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

export const dynamic = "force-dynamic";

export default async function NewLabelReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ labelId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { labelId } = await searchParams;

  const [auths, labels] = await Promise.all([
    prisma.companyManufacturerAuthorization.findMany({
      where: { companyId: session.companyId, active: true },
      include: {
        manufacturer: {
          select: { id: true, name: true, displayName: true, sortOrder: true },
        },
      },
    }),
    prisma.serviceLabel.findMany({
      select: {
        id: true,
        manufacturerId: true,
        kind: true,
      },
    }),
  ]);

  const labelsByManu = new Map<string, { id: string; kind: ServiceLabelKind }[]>();
  for (const l of labels) {
    const arr = labelsByManu.get(l.manufacturerId) ?? [];
    arr.push({ id: l.id, kind: l.kind });
    labelsByManu.set(l.manufacturerId, arr);
  }

  const manufacturers: LabelManufacturer[] = auths
    .map((a) => {
      const items = (labelsByManu.get(a.manufacturerId) ?? []).map((l) => ({
        id: l.id,
        kind: l.kind,
        label: serviceLabelKindLabel(l.kind),
      }));
      return {
        id: a.manufacturerId,
        name: displayManufacturer(a.manufacturer),
        sortOrder: a.manufacturer.sortOrder ?? 0,
        labels: items,
      };
    })
    .sort((a, b) => {
      const so = a.sortOrder - b.sortOrder;
      if (so !== 0) return so;
      return a.name.localeCompare(b.name, "hr");
    });

  const prefillLabel = labelId
    ? labels.find((l) => l.id === labelId) ?? null
    : null;

  return (
    <main className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          <Link href="/warehouse/labels" className="hover:underline">
            Servisne naljepnice
          </Link>{" "}
          /{" "}
          <Link href="/warehouse/labels/receipts" className="hover:underline">
            Primke
          </Link>{" "}
          / Nova
        </div>
        <h1 className="text-3xl font-bold">Nova primka naljepnica</h1>
        <p className="mt-1 text-sm text-slate-600">
          Unesite stavke primljenih servisnih naljepnica. Dobavljač je uvijek MUP RH. Prikazuju se
          samo proizvođači za koje imate aktivno ovlaštenje. Spremanjem se automatski ažurira stanje.
        </p>
      </div>

      {manufacturers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          Nemate aktivnih ovlaštenja. Aktivirajte ih u{" "}
          <Link href="/admin/settings/authorizations" className="text-slate-900 underline">
            Postavke → Ovlaštenja
          </Link>{" "}
          kako biste mogli primati naljepnice.
        </div>
      ) : (
        <LabelReceiptForm
          manufacturers={manufacturers}
          prefillManufacturerId={prefillLabel?.manufacturerId ?? null}
          prefillLabelId={prefillLabel?.id ?? null}
        />
      )}
    </main>
  );
}
