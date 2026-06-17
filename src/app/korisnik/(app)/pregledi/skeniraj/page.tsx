import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import ScanClient from "./ScanClient";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");

  return (
    <>
      <section className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Skeniraj aparat</h1>
          <p className="mt-1 text-sm text-slate-600">Skenirajte QR kod ili unesite oznaku za unos redovnog pregleda.</p>
        </div>
        <Link href="/korisnik/pregledi" className="text-sm text-red-700 hover:underline">← Natrag</Link>
      </section>

      <ScanClient />
    </>
  );
}
