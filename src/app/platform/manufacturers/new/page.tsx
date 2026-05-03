import Link from "next/link";
import PlatformNewManufacturerForm from "@/components/PlatformNewManufacturerForm";
import { requirePlatformSession } from "@/lib/platformAuth";

export default async function PlatformNewManufacturerPage() {
  await requirePlatformSession();
  return (
    <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl">
      <aside className="lg:col-span-1 space-y-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Novi proizvođač</h1>
          <p className="mt-1 text-sm text-slate-600">
            Unesi proizvođača. Tipove aparata dodaješ na stranici Aparati.
          </p>
        </div>
        <Link className="btn btn-outline w-full justify-center px-4" href="/platform/manufacturers">
          ← Proizvođači
        </Link>
      </aside>

      <div className="lg:col-span-2">
        <PlatformNewManufacturerForm />
      </div>
    </main>
  );
}

