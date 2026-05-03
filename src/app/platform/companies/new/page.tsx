import Link from "next/link";
import PlatformNewCompanyForm from "@/components/PlatformNewCompanyForm";
import { requirePlatformSession } from "@/lib/platformAuth";

export default async function PlatformNewCompanyPage() {
  await requirePlatformSession();
  return (
    <main className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Nova tvrtka</h1>
          <p className="mt-1 text-sm text-slate-600">Kreiraj tenant i 2 standardna računa (admin + workshop).</p>
        </div>
        <Link className="btn btn-outline px-4" href="/platform/companies">
          ← Tvrtke
        </Link>
      </div>

      <PlatformNewCompanyForm />
    </main>
  );
}

