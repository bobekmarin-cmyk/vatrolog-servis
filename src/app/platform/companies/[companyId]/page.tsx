import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import CompanyTabNav, { type CompanyTab } from "./CompanyTabNav";
import OverviewTab from "./_tabs/OverviewTab";
import AccountsTab from "./_tabs/AccountsTab";
import InventoryTab from "./_tabs/InventoryTab";
import OperationsTab from "./_tabs/OperationsTab";
import CommunicationsTab from "./_tabs/CommunicationsTab";
import SettingsTab from "./_tabs/SettingsTab";
import DangerZoneTab from "./_tabs/DangerZoneTab";

export const dynamic = "force-dynamic";

/**
 * Izolirano u helper jer ESLint `react-hooks/purity` ne dozvoljava `Date.now()`
 * direktno u tijelu server komponente (smatra je impure renderom).
 */
function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

const VALID_TABS = [
  "overview",
  "accounts",
  "inventory",
  "operations",
  "comms",
  "settings",
  "danger",
] as const;
type TabId = (typeof VALID_TABS)[number];

function parseTab(raw: string | string[] | undefined): TabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && (VALID_TABS as readonly string[]).includes(v)) return v as TabId;
  return "overview";
}

function parseSingle(raw: string | string[] | undefined): string | null {
  if (!raw) return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.length > 0 ? v : null;
}

export default async function PlatformCompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<{
    tab?: string | string[];
    emailStatus?: string | string[];
    emailKind?: string | string[];
    forceUnlock?: string | string[];
    hardPurge?: string | string[];
  }>;
}) {
  await requirePlatformSession();
  const { companyId } = await params;
  const sp = (await searchParams) ?? {};
  const tab = parseTab(sp.tab);
  const emailStatus = parseSingle(sp.emailStatus);
  const emailKind = parseSingle(sp.emailKind);

  // Bazni metapodaci o tvrtki + brojaci za tab badge-eve.
  // Sve badge brojeve dohvacamo jednim Promise.all, da nema sekvencijalnog cekanja.
  const [company, pendingDraftCount, openInvoicesCount, failedEmails30dCount] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        oib: true,
        serviceCode: true,
        street: true,
        postalCode: true,
        city: true,
        iban: true,
        email: true,
        phone: true,
        contactName: true,
        blocked: true,
        deletedAt: true,
        activeUntil: true,
      },
    }),
    prisma.workOrder.count({ where: { companyId, status: "LOCKED" } }),
    prisma.invoice.count({
      where: { companyId, status: { in: ["ISSUED", "OVERDUE", "DRAFT"] } },
    }),
    prisma.emailLog.count({
      where: {
        companyId,
        status: "FAILED",
        sentAt: { gte: thirtyDaysAgo() },
      },
    }),
  ]);

  if (!company) notFound();

  const tabs: CompanyTab[] = [
    { id: "overview", label: "Pregled" },
    { id: "accounts", label: "Racuni i lokacije" },
    { id: "inventory", label: "Aparati i kupci" },
    {
      id: "operations",
      label: "Nalozi i dokumenti",
      badge: pendingDraftCount + openInvoicesCount,
      badgeTone: pendingDraftCount > 0 ? "warning" : "neutral",
    },
    {
      id: "comms",
      label: "Komunikacija",
      badge: failedEmails30dCount,
      badgeTone: failedEmails30dCount > 0 ? "danger" : "neutral",
    },
    { id: "settings", label: "Pretplata i moduli" },
    { id: "danger", label: "Opasna zona" },
  ];

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{company.name}</h1>
            {company.deletedAt ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-800 ring-1 ring-red-200">
                Soft-deleted
              </span>
            ) : null}
            {company.blocked ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 ring-1 ring-amber-200">
                Blokirana
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">OIB:</span>{" "}
            <span className="font-mono">{company.oib}</span>
            <span className="mx-2 text-slate-300">|</span>
            <span className="font-medium">Sifra:</span>{" "}
            <span className="font-mono">{company.serviceCode}</span>
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-slate-500">
              {company.street}, {company.postalCode} {company.city}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn btn-outline px-4" href="/platform/companies">
            ← Tvrtke
          </Link>
          <form action={`/api/platform/companies/${company.id}/impersonate`} method="post">
            <button className="btn btn-outline px-4" type="submit">
              Pristupi kao tvrtka
            </button>
          </form>
          <Link
            className="btn btn-primary px-4"
            href={`/platform/companies/${company.id}/edit`}
          >
            Uredi podatke
          </Link>
        </div>
      </div>

      <CompanyTabNav companyId={company.id} tabs={tabs} activeTab={tab} />

      <div className="pt-4">
        {tab === "overview" && <OverviewTab companyId={company.id} />}
        {tab === "accounts" && <AccountsTab companyId={company.id} />}
        {tab === "inventory" && <InventoryTab companyId={company.id} />}
        {tab === "operations" && <OperationsTab companyId={company.id} />}
        {tab === "comms" && (
          <CommunicationsTab
            companyId={company.id}
            emailStatusFilter={emailStatus}
            emailKindFilter={emailKind}
          />
        )}
        {tab === "settings" && <SettingsTab companyId={company.id} />}
        {tab === "danger" && (
          <DangerZoneTab
            companyId={company.id}
            forceUnlockFlash={parseSingle(sp.forceUnlock)}
            hardPurgeFlash={parseSingle(sp.hardPurge)}
          />
        )}
      </div>
    </main>
  );
}
