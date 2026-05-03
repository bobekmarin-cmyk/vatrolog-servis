import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/**
 * Front door:
 *  - prijavljeni korisnik ide na /dashboard,
 *  - svi ostali idu na /landing (marketing + opis proizvoda + zahtjev za probni pristup).
 *
 * Ovaj file je IZVAN (company) route grupe pa se ne provlači kroz auth-only layout.
 */
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  redirect("/landing");
}
