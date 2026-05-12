-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "NotificationCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isUpdate" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationCategory_slug_key" ON "NotificationCategory"("slug");

-- CreateIndex
CREATE INDEX "NotificationCategory_active_sortOrder_idx" ON "NotificationCategory"("active", "sortOrder");

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "updatePayload" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "authorPlatformUserId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_status_publishedAt_idx" ON "Notification"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Notification_categoryId_idx" ON "Notification"("categoryId");

-- CreateTable
CREATE TABLE "NotificationRead" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "accountUserId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRead_notificationId_accountUserId_key" ON "NotificationRead"("notificationId", "accountUserId");

-- CreateIndex
CREATE INDEX "NotificationRead_accountUserId_idx" ON "NotificationRead"("accountUserId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "NotificationCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_authorPlatformUserId_fkey" FOREIGN KEY ("authorPlatformUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_accountUserId_fkey" FOREIGN KEY ("accountUserId") REFERENCES "AccountUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default kategorije
INSERT INTO "NotificationCategory" ("id", "slug", "name", "description", "isUpdate", "color", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  ('cat_general', 'opcenito', 'Općenito', 'Opće obavijesti tvrtkama korisnicama programa.', false, '#475569', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_maintenance', 'odrzavanje', 'Obavijest o održavanju', 'Najavljeno održavanje, planirani prekidi rada, migracije.', false, '#d97706', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_updates', 'azuriranja', 'Ažuriranja', 'Nove verzije programa — što je novo, poboljšano ili ispravljeno.', true, '#16a34a', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
