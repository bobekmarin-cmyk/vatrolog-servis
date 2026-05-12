import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import {
  isUpdatePayload,
  markRead,
  UPDATE_SECTION_LABELS,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const SECTION_BADGE_CLASSES: Record<string, string> = {
  NEW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  IMPROVED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  FIXED: "bg-amber-100 text-amber-800 border-amber-200",
  IMPORTANT: "bg-rose-100 text-rose-800 border-rose-200",
};

export default async function NotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const n = await prisma.notification.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, color: true, isUpdate: true } },
      authorPlatformUser: { select: { username: true } },
    },
  });
  if (!n || n.status !== "PUBLISHED") notFound();

  await markRead({ notificationId: n.id, accountUserId: session.accountUserId });

  const date = n.publishedAt ?? n.createdAt;
  const update =
    n.category.isUpdate && isUpdatePayload(n.updatePayload) ? n.updatePayload : null;

  return (
    <main className="space-y-5">
      <div>
        <Link
          href="/notifications"
          className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
        >
          ← Sve obavijesti
        </Link>
      </div>

      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
          <span className="text-slate-500">{formatDateDdMmYyyy(date)}</span>
          {n.authorPlatformUser?.username ? (
            <span className="text-slate-500">· {n.authorPlatformUser.username}</span>
          ) : null}
          {update?.version ? (
            <span className="rounded-md border border-slate-200 px-2 py-0.5 font-mono text-[11px] text-slate-700">
              v{update.version}
            </span>
          ) : null}
        </div>

        <h1 className="mt-3 text-2xl font-bold text-slate-900">{n.title}</h1>
        {n.summary ? (
          <p className="mt-1 text-sm text-slate-600">{n.summary}</p>
        ) : null}

        {n.body && n.body.trim().length > 0 ? (
          <div className="prose prose-sm mt-5 max-w-none whitespace-pre-wrap text-slate-800">
            {n.body}
          </div>
        ) : null}

        {update ? (
          <div className="mt-6 space-y-4">
            {update.sections.map((s, idx) => (
              <section
                key={idx}
                className={[
                  "rounded-lg border p-4",
                  SECTION_BADGE_CLASSES[s.kind] ?? "bg-slate-100 text-slate-800 border-slate-200",
                ].join(" ")}
              >
                <h2 className="text-sm font-semibold uppercase tracking-wide">
                  {s.title?.trim() ? s.title : UPDATE_SECTION_LABELS[s.kind]}
                </h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {s.items.map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true">•</span>
                      <span className="whitespace-pre-wrap">{it}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
      </article>
    </main>
  );
}
