import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminUsersClient from "./AdminUsersClient";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/?forbidden=1");

  const [accounts, recentTokens] = await Promise.all([
    prisma.accountUser.findMany({
      where: { companyId: session.companyId },
      orderBy: { username: "asc" },
      select: {
        id: true,
        username: true,
        role: true,
        active: true,
        email: true,
        lastLoginAt: true,
        sessionsValidAfter: true,
        serviceLocation: { select: { id: true, kind: true, label: true } },
      },
    }),
    prisma.authToken.findMany({
      where: {
        companyId: session.companyId,
        type: { in: ["ACCOUNT_INVITE", "PASSWORD_RESET", "SUBACCOUNT_PASSWORD_SETUP"] },
      },
      select: {
        accountUserId: true,
        type: true,
        createdAt: true,
        expiresAt: true,
        usedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const latestByAccount = new Map<
    string,
    {
      type: "ACCOUNT_INVITE" | "PASSWORD_RESET" | "SUBACCOUNT_PASSWORD_SETUP";
      createdAt: Date;
      expiresAt: Date;
      usedAt: Date | null;
    }
  >();
  const activeTokenByAccount = new Map<
    string,
    {
      type: "ACCOUNT_INVITE" | "PASSWORD_RESET" | "SUBACCOUNT_PASSWORD_SETUP";
      createdAt: Date;
      expiresAt: Date;
    }
  >();
  for (const t of recentTokens) {
    if (!t.accountUserId) continue;
    if (!latestByAccount.has(t.accountUserId)) {
      latestByAccount.set(t.accountUserId, {
        type: t.type as "ACCOUNT_INVITE" | "PASSWORD_RESET" | "SUBACCOUNT_PASSWORD_SETUP",
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        usedAt: t.usedAt,
      });
    }
    if (
      !t.usedAt &&
      t.expiresAt > new Date() &&
      !activeTokenByAccount.has(t.accountUserId)
    ) {
      activeTokenByAccount.set(t.accountUserId, {
        type: t.type as "ACCOUNT_INVITE" | "PASSWORD_RESET" | "SUBACCOUNT_PASSWORD_SETUP",
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
      });
    }
  }

  const data = accounts.map((a) => {
    const latest = latestByAccount.get(a.id) ?? null;
    const activeTok = activeTokenByAccount.get(a.id) ?? null;
    return {
      id: a.id,
      username: a.username,
      role: a.role as "ADMIN" | "WORKSHOP",
      active: a.active,
      email: a.email,
      lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
      location: a.serviceLocation
        ? {
            id: a.serviceLocation.id,
            kind: a.serviceLocation.kind as "STATIONARY" | "VEHICLE",
            label: a.serviceLocation.label,
          }
        : null,
      latestToken: latest
        ? { type: latest.type, createdAt: latest.createdAt.toISOString(), used: latest.usedAt !== null }
        : null,
      activeToken: activeTok
        ? { type: activeTok.type, expiresAt: activeTok.expiresAt.toISOString() }
        : null,
    };
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Korisnici</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pregled svih korisničkih računa za vašu tvrtku. Možete promijeniti lozinke ili poslati
          setup link novim sub-računima.
        </p>
      </div>

      <AdminUsersClient currentAccountId={session.accountUserId} accounts={data} />
    </main>
  );
}
