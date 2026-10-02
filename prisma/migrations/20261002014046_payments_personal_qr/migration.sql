-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT,
    "reason" TEXT,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "buyerPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "payMethod" TEXT NOT NULL,
    "sellerId" TEXT,
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT,
    "refCode" TEXT,
    "inviteCode" TEXT,
    "invitedBy" TEXT,
    "showOnWall" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" DATETIME,
    "confirmedById" TEXT,
    "emergencyAdmittedAt" DATETIME,
    "emergencyAdmitReason" TEXT,
    "emergencyAdmittedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_emergencyAdmittedById_fkey" FOREIGN KEY ("emergencyAdmittedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("buyerEmail", "buyerName", "buyerPhone", "createdAt", "eventId", "id", "inviteCode", "invitedBy", "notes", "payMethod", "refCode", "sellerId", "showOnWall", "status", "totalCents") SELECT "buyerEmail", "buyerName", "buyerPhone", "createdAt", "eventId", "id", "inviteCode", "invitedBy", "notes", "payMethod", "refCode", "sellerId", "showOnWall", "status", "totalCents" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_refCode_key" ON "Order"("refCode");
CREATE UNIQUE INDEX "Order_inviteCode_key" ON "Order"("inviteCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
