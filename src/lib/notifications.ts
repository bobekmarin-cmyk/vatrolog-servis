import { prisma } from "@/lib/prisma";

/**
 * Logika za vendor → admin obavijesti.
 *
 * Primatelji:
 *   • Trenutno se objavljene (`PUBLISHED`) obavijesti smatraju vidljivima svim
 *     ADMIN računima svih aktivnih (ne soft-deleted, ne blokiranih) tvrtki.
 *   • Pročitanost se vodi po (notificationId, accountUserId) — svaki admin mora
 *     pročitati zasebno (cilj: sidebar badge prisiljava admin korisnika da uđe u
 *     stranicu i pročita poruku).
 *
 * Sidebar prikazuje broj nepročitanih objavljenih obavijesti za trenutno
 * prijavljenog admina; za WORKSHOP račune ne prikazujemo stavku Obavijesti.
 */

/**
 * Konstante i tipovi žive u `@/lib/notificationsShared` (bez Prisme) da ih
 * smiju koristiti i `"use client"` componente. Re-export radi kompatibilnosti.
 */
export {
  NOTIFICATIONS_HOME_PATH,
  UPDATE_SECTION_KINDS,
  UPDATE_SECTION_LABELS,
  isUpdatePayload,
} from "@/lib/notificationsShared";
export type {
  UpdatePayload,
  UpdateSection,
  UpdateSectionKind,
} from "@/lib/notificationsShared";

/**
 * Vrati broj objavljenih obavijesti koje admin još nije pročitao.
 * Za role !== ADMIN vraća 0 (sidebar badge se ne prikazuje).
 */
export async function countUnreadForAccount(params: {
  accountUserId: string;
  role: "ADMIN" | "WORKSHOP";
}): Promise<number> {
  if (params.role !== "ADMIN") return 0;

  const [totalPublished, readCount] = await Promise.all([
    prisma.notification.count({ where: { status: "PUBLISHED" } }),
    prisma.notificationRead.count({
      where: {
        accountUserId: params.accountUserId,
        notification: { status: "PUBLISHED" },
      },
    }),
  ]);
  if (totalPublished === 0) return 0;

  const unread = totalPublished - readCount;
  return unread > 0 ? unread : 0;
}

/**
 * Označi jednu objavljenu obavijest pročitanom za danog admina (idempotentno).
 */
export async function markRead(params: {
  notificationId: string;
  accountUserId: string;
}): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: params.notificationId },
    select: { id: true, status: true },
  });
  if (!notification || notification.status !== "PUBLISHED") return;

  await prisma.notificationRead.upsert({
    where: {
      notificationId_accountUserId: {
        notificationId: params.notificationId,
        accountUserId: params.accountUserId,
      },
    },
    update: {},
    create: {
      notificationId: params.notificationId,
      accountUserId: params.accountUserId,
    },
  });
}

/** Označi sve objavljene obavijesti pročitanima za danog admina. */
export async function markAllRead(accountUserId: string): Promise<number> {
  const published = await prisma.notification.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true },
  });
  if (published.length === 0) return 0;

  let created = 0;
  for (const n of published) {
    const res = await prisma.notificationRead.upsert({
      where: {
        notificationId_accountUserId: {
          notificationId: n.id,
          accountUserId,
        },
      },
      update: {},
      create: { notificationId: n.id, accountUserId },
      select: { id: true },
    });
    if (res?.id) created += 1;
  }
  return created;
}
