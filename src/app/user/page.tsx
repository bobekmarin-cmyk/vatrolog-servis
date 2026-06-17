import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Kratki, marketinški link za vlasnike aparata: vatrolog.com/user
 * Preusmjerava na Korisnički portal (dashboard ako je prijavljen, inače login).
 */
export default function UserEntryPage() {
  redirect("/korisnik");
}
