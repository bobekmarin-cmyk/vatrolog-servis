import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SetupRequiredPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <section className="surface">
        <div className="surface-header">
          <h1 className="h1">Potrebne su postavke tvrtke</h1>
        </div>
        <div className="surface-body space-y-3">
          <p className="text-sm text-slate-700">
            Admin mora unijeti obavezne podatke tvrtke (IBAN, e-mail i kontakt broj) u{" "}
            <span className="font-medium">Postavke → Postavke tvrtke</span>.
          </p>
          <p className="text-sm text-slate-700">
            Nakon toga ćete moći nastaviti koristiti aplikaciju.
          </p>

          <div className="pt-2">
            <form action="/api/auth/logout" method="post">
              <button className="btn btn-outline px-4" type="submit">
                Odjava
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

