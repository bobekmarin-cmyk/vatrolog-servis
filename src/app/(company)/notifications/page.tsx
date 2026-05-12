import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";

export const dynamic = "force-dynamic";

function statusDot(read: boolean) {
  return (
    <span
      className={[
        "inline-block h-2 w-2 rounded-full",
        read ? "bg-slate-300" : "bg-red-500",
      ].join(" ")}
      aria-hidden="true"
    />
  );
}

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const notifications = await prisma.notification.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    include: {
      category: { select: { id: true, name: true, color: true, isUpdate: true } },
    },
  });

  const reads = await prisma.notificationRead.findMany({
    where: { accountUserId: session.accountUserId },
    select: { notificationId: true },
  });
  const readSet = new Set(reads.map((r) => r.notificationId));

  const unreadCount = notifications.reduce(
    (acc, n) => acc + (readSet.has(n.id) ? 0 : 1),
    0,
  );

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Obavijesti</h1>
          <p className="text-sm text-slate-600">
            Poruke i ažuriranja koja vam šalje vendor programa. Otvaranjem se obavijest označava
            pročitanom.
          </p>
        </div>
        <div className="text-sm text-slate-600">
          Nepročitano:{" "}
          <span
            className={[
              "ml-1 inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
              unreadCount > 0 ? "bg-red-600 text-white" : "bg-slate-200 text-slate-600",
            ].join(" ")}
          >
            {unreadCount}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 w-28">Datum</th>
              <th className="px-3 py-2 w-44">Kategorija</th>
              <th className="px-3 py-2">Naslov</th>
              <th className="px-3 py-2 w-20 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {notifications.map((n) => {
              const read = readSet.has(n.id);
              const date = n.publishedAt ?? n.createdAt;
              return (
                <tr
                  key={n.id}
                  className={read ? "" : "bg-red-50/40"}
                >
                  <td className="px-3 py-2 align-top">{statusDot(read)}</td>
                  <td className="px-3 py-2 align-top text-slate-700 tabular-nums">
                    {formatDateDdMmYyyy(date)}
                  </td>
                  <td className="px-3 py-2 align-top">
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
                  <td className="px-3 py-2 align-top">
                    <Link
                      href={`/notifications/${n.id}`}
                      className={[
                        "block hover:underline",
                        read ? "text-slate-700" : "font-semibold text-slate-900",
                      ].join(" ")}
                    >
                      {n.pinned ? <span className="mr-1 text-amber-600">📌</span> : null}
                      {n.title}
                    </Link>
                    {n.summary ? (
                      <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{n.summary}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top text-right text-xs text-slate-500">
                    {read ? "Pročitano" : "Novo"}
                  </td>
                </tr>
              );
            })}
            {notifications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-500">
                  Trenutno nema objavljenih obavijesti.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
