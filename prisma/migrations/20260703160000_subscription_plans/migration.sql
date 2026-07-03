-- Planovi pretplate: Start / Standard / Premium.
-- Postojeće tvrtke (i novi signupovi tijekom triala) dobivaju PREMIUM;
-- platforma ručno upravlja planom.

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('START', 'STANDARD', 'PREMIUM');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "plan" "SubscriptionPlan" NOT NULL DEFAULT 'PREMIUM';
