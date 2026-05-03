-- CreateTable
CREATE TABLE "CustomerBacklogSnooze" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "monthStart" TIMESTAMP(3) NOT NULL,
    "ignoreCount" INTEGER NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerBacklogSnooze_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerBacklogSnooze_customerId_monthStart_key" ON "CustomerBacklogSnooze"("customerId", "monthStart");

-- AddForeignKey
ALTER TABLE "CustomerBacklogSnooze" ADD CONSTRAINT "CustomerBacklogSnooze_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
