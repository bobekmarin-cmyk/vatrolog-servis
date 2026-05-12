import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import CategoriesClient from "./CategoriesClient";

export const dynamic = "force-dynamic";

export default async function PlatformNotificationCategoriesPage() {
  await requirePlatformSession();

  const categories = await prisma.notificationCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { notifications: true } } },
  });

  return (
    <main className="space-y-6">
      <div>
        <Link href="/platform/notifications" className="text-sm text-slate-600 hover:underline">
          ← Sve obavijesti
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Kategorije obavijesti</h1>
        <p className="mt-1 text-sm text-slate-600">
          Kategorije se koriste za grupiranje poruka adminima tvrtki. Kategorija označena{" "}
          <b>„Ažuriranja”</b> dobija proširen prikaz s detaljnim sekcijama (Novo / Poboljšano /
          Ispravljeno / Važno).
        </p>
      </div>

      <CategoriesClient
        initialCategories={categories.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          description: c.description,
          color: c.color,
          isUpdate: c.isUpdate,
          active: c.active,
          sortOrder: c.sortOrder,
          notificationsCount: c._count.notifications,
        }))}
      />
    </main>
  );
}
