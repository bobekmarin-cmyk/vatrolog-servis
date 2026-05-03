-- CreateTable
CREATE TABLE "InternalCodeCounter" (
    "id" TEXT NOT NULL,
    "weightCode" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalCodeCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternalCodeCounter_weightCode_key" ON "InternalCodeCounter"("weightCode");
