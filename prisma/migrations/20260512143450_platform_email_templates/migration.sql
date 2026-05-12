-- CreateTable
CREATE TABLE "PlatformEmailTemplate" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "greeting" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "calloutText" TEXT NOT NULL,
    "closingText" TEXT NOT NULL,
    "footerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PlatformEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformEmailTemplate_type_key" ON "PlatformEmailTemplate"("type");
