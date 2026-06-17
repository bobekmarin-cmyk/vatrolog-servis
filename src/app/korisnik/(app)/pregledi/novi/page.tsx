import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { ownerCanAccessExtinguisher } from "@/lib/ownerInspections";
import RegularInspectionForm from "../RegularInspectionForm";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ ext?: string; company?: string }> };

export default async function NewInspectionPage({ searchParams }: PageProps) {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");

  const { ext, company } = await searchParams;
  const access = ext && company ? await ownerCanAccessExtinguisher(session.ownerId, company, ext) : null;

  if (!access) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Aparat nije pronađen</h1>
        <p className="mt-2 text-sm text-slate-600">
          Aparat ne postoji ili nemate pristup. Pokušajte ponovno skenirati QR kod ili odabrati aparat s popisa.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/korisnik/pregledi/skeniraj" className="btn btn-primary h-9">Skeniraj / unesi oznaku</Link>
          <Link href="/korisnik/aparati" className="btn btn-outline h-9">Popis aparata</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Redovni pregled</h1>
          <p className="mt-1 text-sm text-slate-600">Unesite nalaz tromjesečnog pregleda aparata.</p>
        </div>
        <Link href="/korisnik/pregledi" className="text-sm text-red-700 hover:underline">← Natrag</Link>
      </section>

      <RegularInspectionForm
        extinguisherId={access.extinguisherId}
        companyId={access.companyId}
        internalCode={access.internalCode}
        serialNumber={access.serialNumber}
        typeCode={access.typeCode}
        manufacturerName={access.manufacturerName}
        servicerName={access.servicerName}
      />
    </>
  );
}
