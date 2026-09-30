-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "subscriptionStatus" TEXT DEFAULT 'NONE';
