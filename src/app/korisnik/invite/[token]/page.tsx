import Link from "next/link";
import VatroLogLogo from "@/components/VatroLogLogo";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/authTokens";
import OwnerAcceptInviteForm from "./OwnerAcceptInviteForm";

export const metadata = {
  title: "Korisnički portal — aktivacija",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm surface p-6 shadow-lg">
        <div className="flex justify-center mb-4">
          <VatroLogLogo size="lg" />
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function OwnerInvitePage({ params }: PageProps) {
  const { token } = await params;

  const record = token
    ? await prisma.authToken.findFirst({
        where: { tokenHash: hashToken(token), type: "OWNER_INVITE", usedAt: null, expiresAt: { gt: new Date() } },
      })
    : null;

  if (!record?.email) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Pozivnica nije važeća</h1>
        <p className="mt-2 text-sm text-slate-600">
          Link je istekao ili je već iskorišten. Zatražite novu pozivnicu od svog servisa.
        </p>
        <Link href="/korisnik/login" className="btn btn-outline h-10 mt-6 w-full">Idi na prijavu</Link>
      </Shell>
    );
  }

  const email = record.email.toLowerCase();
  const meta = (record.meta ?? {}) as { customerId?: string };

  const [owner, customer] = await Promise.all([
    prisma.owner.findUnique({ where: { email }, select: { passwordHash: true } }),
    meta.customerId
      ? prisma.customer.findUnique({
          where: { id: meta.customerId },
          select: { name: true, shortName: true, company: { select: { name: true } } },
        })
      : Promise.resolve(null),
  ]);

  const hasAccount = !!owner?.passwordHash;
  const servicerName = customer?.company.name ?? null;
  const customerName = customer ? customer.shortName ?? customer.name : null;

  return (
    <Shell>
      <h1 className="text-2xl font-bold">Aktivacija pristupa</h1>
      <p className="mt-2 text-sm text-slate-600">
        {servicerName ? (
          <>Servis <strong>{servicerName}</strong> poziva vas na Korisnički portal{customerName ? <> za <strong>{customerName}</strong></> : null}.</>
        ) : (
          <>Aktivirajte svoj pristup Korisničkom portalu.</>
        )}
      </p>
      <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
        E-mail: <span className="font-mono">{email}</span>
      </div>

      <div className="mt-6">
        <OwnerAcceptInviteForm token={token} hasAccount={hasAccount} />
      </div>
    </Shell>
  );
}
