import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashToken } from "@/lib/authTokens";
import SubaccountPasswordSetupForm from "./SubaccountPasswordSetupForm";

export default async function SubaccountPasswordSetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const session = await getSession();
  const { token } = await params;

  if (!session) {
    const next = encodeURIComponent(`/admin/users/setup/${token}`);
    redirect(`/login?next=${next}`);
  }
  if (session.role !== "ADMIN") {
    redirect("/?forbidden=1");
  }

  const tokenHash = hashToken(token);
  const record = await prisma.authToken.findFirst({
    where: {
      tokenHash,
      type: "SUBACCOUNT_PASSWORD_SETUP",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      accountUser: {
        select: { id: true, username: true, role: true, active: true, companyId: true },
      },
      company: { select: { id: true, name: true, serviceCode: true } },
    },
  });

  if (
    !record ||
    !record.accountUser ||
    !record.company ||
    record.accountUser.role === "ADMIN"
  ) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-bold">Setup link nije važeći</h1>
        <div className="surface p-4 text-sm text-slate-600">
          Setup link je neispravan ili je istekao. Tražite od support tima da pošalje novi.
        </div>
        <Link className="btn btn-outline" href="/admin/users">
          ← Korisnici
        </Link>
      </main>
    );
  }

  if (record.company.id !== session.companyId || record.accountUser.companyId !== session.companyId) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-bold">Setup link nije za vašu tvrtku</h1>
        <div className="surface p-4 text-sm text-slate-600">
          Ovaj setup link pripada drugoj tvrtki. Provjerite da ste prijavljeni s odgovarajućim admin
          računom.
        </div>
        <Link className="btn btn-outline" href="/admin/users">
          ← Korisnici
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Postavi lozinku za sub-račun</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tvrtka: <strong>{record.company.name}</strong> · Šifra servisa{" "}
          <span className="font-mono">{record.company.serviceCode}</span>
        </p>
      </div>

      <div className="surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Korisničko ime</div>
            <div className="font-mono text-lg font-semibold">{record.accountUser.username}</div>
          </div>
          {record.accountUser.active ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              Aktivan
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Čeka aktivaciju
            </span>
          )}
        </div>
        <SubaccountPasswordSetupForm token={token} username={record.accountUser.username} />
      </div>
    </main>
  );
}
