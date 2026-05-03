import Link from "next/link";
import NewCustomerFromOibForm from "@/components/NewCustomerFromOibForm";

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from ?? null;
  const cancelHref = from === "work-order-new" ? "/work-orders/new" : "/customers";
  const cancelLabel = from === "work-order-new" ? "← Natrag na radni nalog" : "← Kupci";

  return (
    <main className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Novi kupac</h1>
        <div className="flex gap-2">
          <Link className="btn btn-outline px-4" href={cancelHref}>
            {cancelLabel}
          </Link>
          <Link className="btn btn-outline px-4" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>

      <NewCustomerFromOibForm from={from} />
    </main>
  );
}
