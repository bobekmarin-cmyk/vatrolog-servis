import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import { isUpdatePayload } from "@/lib/notifications";
import NotificationComposer from "../NotificationComposer";

export const dynamic = "force-dynamic";

export default async function PlatformEditNotificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformSession();
  const { id } = await params;

  const [n, categories] = await Promise.all([
    prisma.notification.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, isUpdate: true } },
        _count: { select: { reads: true } },
      },
    }),
    prisma.notificationCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, isUpdate: true },
    }),
  ]);

  if (!n) notFound();

  const update = isUpdatePayload(n.updatePayload) ? n.updatePayload : null;

  return (
    <main className="space-y-6">
      <div>
        <Link href="/platform/notifications" className="text-sm text-slate-600 hover:underline">
          ← Sve obavijesti
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{n.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Status: <b>{n.status}</b> · Pročitanost: {n._count.reads}
        </p>
      </div>

      <NotificationComposer
        mode="edit"
        notificationId={n.id}
        categories={categories}
        initialState={{
          categoryId: n.categoryId,
          title: n.title,
          summary: n.summary ?? "",
          body: n.body,
          status: n.status,
          pinned: n.pinned,
          update: update,
        }}
      />
    </main>
  );
}
