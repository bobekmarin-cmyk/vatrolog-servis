import Link from "next/link";
import { getCommunicationStats } from "@/lib/companyDetailStats";
import { getCompanyRecentActivity } from "@/lib/auditLog";
import { Section, StatusPill, fmtDateTime } from "./shared";

const KIND_LABEL: Record<string, string> = {
  CUSTOMER_NOTIFICATION: "Obavijest kupcu",
  PASSWORD_RESET: "Reset lozinke",
  ACCOUNT_INVITE: "Pozivnica",
  EMAIL_VERIFY: "Verifikacija",
  SUBSCRIPTION_EXPIRY: "Istek pretplate",
  MONTHLY_REMINDER: "Mjesecni podsjetnik",
  VENDOR_TEST: "Test mail",
  OTHER: "Ostalo",
};

export default async function CommunicationsTab({
  companyId,
  emailStatusFilter,
  emailKindFilter,
}: {
  companyId: string;
  emailStatusFilter?: string | null;
  emailKindFilter?: string | null;
}) {
  const [comm, audit] = await Promise.all([
    getCommunicationStats(companyId, {
      status: emailStatusFilter ?? null,
      kind: emailKindFilter ?? null,
    }),
    getCompanyRecentActivity(companyId, 10),
  ]);

  const statusFilters: ReadonlyArray<{ value: string | null; label: string; tone?: "success" | "danger" }> = [
    { value: null, label: "Sve" },
    { value: "SENT", label: "Uspjesno", tone: "success" },
    { value: "FAILED", label: "Neuspjesno", tone: "danger" },
  ];
  const kindFilters: ReadonlyArray<{ value: string | null; label: string }> = [
    { value: null, label: "Sve" },
    ...comm.countsByKind.map((k) => ({ value: k.kind, label: KIND_LABEL[k.kind] ?? k.kind })),
  ];

  return (
    <div className="space-y-4">
      <Section title="Email — sazetak">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {comm.countsByStatus.map((s) => (
            <div
              key={s.status}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {s.status}
              </div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums">{s.count}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Trend 30 dana (uspjesno vs neuspjesno)">
        <DailyTrend keys={comm.trend30d.keys} sent={comm.trend30d.sent} failed={comm.trend30d.failed} />
      </Section>

      <Section
        title="Email log (zadnjih 50)"
        right={
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500">Status:</span>
            {statusFilters.map((f) => {
              const active = (f.value ?? null) === (emailStatusFilter ?? null);
              const url = buildFilterUrl(companyId, f.value, emailKindFilter ?? null);
              const toneActive =
                f.tone === "success"
                  ? "bg-emerald-700 text-white"
                  : f.tone === "danger"
                    ? "bg-red-700 text-white"
                    : "bg-slate-900 text-white";
              return (
                <Link
                  key={`s-${f.value ?? "all"}`}
                  href={url}
                  className={
                    "rounded-full px-2.5 py-0.5 font-medium " +
                    (active ? toneActive : "bg-slate-100 text-slate-700 hover:bg-slate-200")
                  }
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        }
      >
        {kindFilters.length > 1 ? (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500">Tip:</span>
            {kindFilters.map((f) => {
              const active = (f.value ?? null) === (emailKindFilter ?? null);
              const url = buildFilterUrl(companyId, emailStatusFilter ?? null, f.value);
              return (
                <Link
                  key={`k-${f.value ?? "all"}`}
                  href={url}
                  className={
                    "rounded-full px-2.5 py-0.5 font-medium " +
                    (active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200")
                  }
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        ) : null}

        {comm.latestEmails.length === 0 ? (
          <p className="text-sm text-slate-500">Nijedan email ne odgovara filteru.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-600">
                  <th className="p-2">Vrijeme</th>
                  <th className="p-2">Prima</th>
                  <th className="p-2">Tip</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Transport</th>
                  <th className="p-2">Greska</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comm.latestEmails.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 align-top">
                    <td className="p-2 text-xs text-slate-600 whitespace-nowrap">{fmtDateTime(e.sentAt)}</td>
                    <td className="p-2 text-xs">
                      <div className="font-mono">{e.toEmail}</div>
                      <div className="truncate text-[11px] text-slate-400 max-w-[28ch]">{e.subject}</div>
                    </td>
                    <td className="p-2 text-xs text-slate-600">{KIND_LABEL[e.kind] ?? e.kind}</td>
                    <td className="p-2">
                      <StatusPill status={e.status} />
                    </td>
                    <td className="p-2 text-[11px] text-slate-500">{e.transport ?? "—"}</td>
                    <td className="p-2 text-[11px] text-red-700 max-w-[40ch] truncate">{e.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Audit log (zadnjih 10 za ovu tvrtku)"
        right={
          <Link
            href={`/platform/audit?companyId=${companyId}`}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Otvori puni log →
          </Link>
        }
      >
        {audit.length === 0 ? (
          <p className="text-sm text-slate-500">Nema audit zapisa za ovu tvrtku.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {audit.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2">
                <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap mt-1 w-32 shrink-0">
                  {fmtDateTime(a.createdAt)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs text-slate-700">{a.action}</div>
                  {a.entity ? (
                    <div className="text-[11px] text-slate-500">
                      {a.entity}
                      {a.entityId ? ` · ${a.entityId.slice(0, 12)}…` : ""}
                    </div>
                  ) : null}
                </div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 mt-1">
                  {a.actorType}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function buildFilterUrl(companyId: string, status: string | null, kind: string | null) {
  const sp = new URLSearchParams();
  sp.set("tab", "comms");
  if (status) sp.set("emailStatus", status);
  if (kind) sp.set("emailKind", kind);
  return `/platform/companies/${companyId}?${sp.toString()}`;
}

function DailyTrend({
  keys,
  sent,
  failed,
}: {
  keys: string[];
  sent: number[];
  failed: number[];
}) {
  const max = Math.max(1, ...sent, ...failed);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Uspjeh
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Greska
        </span>
      </div>
      <div className="flex items-end gap-0.5 h-20">
        {keys.map((k, i) => {
          const s = sent[i] ?? 0;
          const f = failed[i] ?? 0;
          return (
            <div key={k} className="flex flex-1 flex-col items-center justify-end gap-0.5 h-full">
              <div className="flex flex-col-reverse w-full gap-0.5 h-full justify-start">
                <div
                  className="w-full rounded-sm bg-emerald-500"
                  style={{ height: `${(s / max) * 100}%`, minHeight: s > 0 ? "1px" : "0" }}
                  title={`${k}: ${s} uspjesno`}
                />
                <div
                  className="w-full rounded-sm bg-red-500"
                  style={{ height: `${(f / max) * 100}%`, minHeight: f > 0 ? "1px" : "0" }}
                  title={`${k}: ${f} neuspjesno`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>{keys[0]?.slice(5)}</span>
        <span>{keys[keys.length - 1]?.slice(5)}</span>
      </div>
    </div>
  );
}
