-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "paymentAutoMatchEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "paymentWebhookSecretHash" TEXT;

-- CreateTable
CREATE TABLE "PaymentIntake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "message" TEXT,
    "senderName" TEXT,
    "senderEmail" TEXT,
    "receivedAt" DATETIME,
    "status" TEXT NOT NULL,
    "matchTier" TEXT,
    "orderId" TEXT,
    "paymentId" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    CONSTRAINT "PaymentIntake_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntake_organizationId_externalId_key" ON "PaymentIntake"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "PaymentIntake_organizationId_status_idx" ON "PaymentIntake"("organizationId", "status");
