import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/authTokens";
import InviteAcceptForm from "./InviteAcceptForm";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const record = await prisma.authToken.findFirst({
    where: {
      tokenHash,
      type: "ACCOUNT_INVITE",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      accountUser: { select: { id: true, role: true, username: true } },
      company: {
        select: {
          id: true,
          name: true,
          serviceCode: true,
          accounts: {
            where: { role: { not: "ADMIN" } },
            orderBy: { username: "asc" },
            select: {
              id: true,
              username: true,
              role: true,
              active: true,
              serviceLocation: { select: { kind: true, label: true } },
            },
          },
        },
      },
    },
  });

  if (!record || !record.accountUser || !record.company || record.accountUser.role !== "ADMIN") {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="surface p-5">
          <h1 className="text-2xl font-bold">Pozivnica nije važeća</h1>
          <p className="mt-2 text-sm text-slate-600">
            Pozivnica je neispravna ili je istekla. Zatražite novu od support tima.
          </p>
        </div>
      </main>
    );
  }

  const adminUsername = record.accountUser.username;
  const workshops = record.company.accounts.map((a) => ({
    id: a.id,
    username: a.username,
    alreadyActive: a.active,
    location: a.serviceLocation
      ? {
          kind: a.serviceLocation.kind as "STATIONARY" | "VEHICLE",
          label: a.serviceLocation.label,
        }
      : null,
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="surface p-5">
        <h1 className="text-2xl font-bold">Postavljanje pristupa za {record.company.name}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Šifra servisa: <span className="font-mono font-semibold">{record.company.serviceCode}</span>.
          Postavite admin lozinku te lozinke za sve user/workshop račune svoje tvrtke.
          Lozinke koje preskočite moći ćete kasnije postaviti iz <span className="font-mono">/admin/users</span>.
        </p>
        <div className="mt-5">
          <InviteAcceptForm
            token={token}
            adminUsername={adminUsername}
            workshops={workshops}
            companyName={record.company.name}
          />
        </div>
      </div>
    </main>
  );
}
