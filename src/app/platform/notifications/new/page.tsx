import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import { APP_VERSION } from "@/lib/appVersion";
import NotificationComposer from "../NotificationComposer";

export const dynamic = "force-dynamic";

export default async function PlatformNewNotificationPage() {
  await requirePlatformSession();

  const categories = await prisma.notificationCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, isUpdate: true },
  });

  return (
    <main className="space-y-6">
      <div>
        <Link href="/platform/notifications" className="text-sm text-slate-600 hover:underline">
          ← Sve obavijesti
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Nova obavijest</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sastavite poruku za sve admine korisničkih tvrtki. Možete je spremiti kao skicu i kasnije
          objaviti.
        </p>
      </div>

      <NotificationComposer
        mode="create"
        categories={categories}
        defaultVersion={APP_VERSION}
      />
    </main>
  );
}
