import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  PUBLISHED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ARCHIVED: "bg-amber-100 text-amber-700 border-amber-200",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Skica",
  PUBLISHED: "Objavljeno",
  ARCHIVED: "Arhivirano",
};

export default async function PlatformNotificationsPage() {
  await requirePlatformSession();

  const [notifications, totalAdmins] = await Promise.all([
    prisma.notification.findMany({
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      include: {
        category: { select: { id: true, name: true, color: true, isUpdate: true } },
        authorPlatformUser: { select: { username: true } },
        _count: { select: { reads: true } },
      },
    }),
    prisma.accountUser.count({
      where: { role: "ADMIN", active: true, company: { deletedAt: null, blocked: false } },
    }),
  ]);

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Obavijesti</h1>
          <p className="mt-1 text-sm text-slate-600">
            Poruke koje se prikazuju adminima svih aktivnih tvrtki. Sidebar im prikazuje crveni broj
            nepročitanih, a otvaranjem se obavijest označava pročitanom.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn btn-outline px-4" href="/platform/notifications/categories">
            Kategorije
          </Link>
          <Link className="btn btn-primary px-4" href="/platform/notifications/new">
            + Nova obavijest
          </Link>
        </div>
      </div>

      <section className="surface">
        <div className="surface-header">
          <h2 className="h1">Sve obavijesti</h2>
          <span className="subtle">
            Aktivnih admina (ciljana publika): <b>{totalAdmins}</b>
          </span>
        </div>
        <div className="h-px bg-black/10" />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-600">
                <th className="p-3 w-28">Datum</th>
                <th className="p-3 w-44">Kategorija</th>
                <th className="p-3">Naslov</th>
                <th className="p-3 w-28">Status</th>
                <th className="p-3 w-32">Pročitanost</th>
                <th className="p-3 text-right w-28">Akcija</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {notifications.map((n) => {
                const date = n.publishedAt ?? n.createdAt;
                const reach = n._count.reads;
                const reachPct =
                  totalAdmins > 0 ? Math.round((reach / totalAdmins) * 100) : 0;
                return (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="p-3 align-top tabular-nums text-slate-700">
                      {formatDateDdMmYyyy(date)}
                    </td>
                    <td className="p-3 align-top">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: (n.category.color ?? "#475569") + "20",
                          color: n.category.color ?? "#475569",
                        }}
                      >
                        {n.category.isUpdate ? "★ " : ""}
                        {n.category.name}
                      </span>
                    </td>
                    <td className="p-3 align-top">
                      <div className="font-medium text-slate-900">
                        {n.pinned ? <span className="mr-1 text-amber-600">📌</span> : null}
                        {n.title}
                      </div>
                      {n.summary ? (
                        <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {n.summary}
                        </div>
                      ) : null}
                      {n.authorPlatformUser?.username ? (
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          autor: {n.authorPlatformUser.username}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 align-top">
                      <span
                        className={[
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          STATUS_BADGE[n.status] ?? STATUS_BADGE.DRAFT,
                        ].join(" ")}
                      >
                        {STATUS_LABEL[n.status] ?? n.status}
                      </span>
                    </td>
                    <td className="p-3 align-top text-xs text-slate-700">
                      {n.status === "PUBLISHED" ? (
                        <span>
                          {reach} / {totalAdmins}{" "}
                          <span className="text-slate-400">({reachPct}%)</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 align-top text-right">
                      <Link
                        className="btn btn-outline h-8 px-3 text-xs"
                        href={`/platform/notifications/${n.id}`}
                      >
                        Uredi
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {notifications.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    Još nema obavijesti. Kliknite <b>+ Nova obavijest</b> da kreirate prvu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
