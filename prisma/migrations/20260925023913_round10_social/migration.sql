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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("buyerEmail", "buyerName", "buyerPhone", "createdAt", "eventId", "id", "notes", "payMethod", "refCode", "sellerId", "status", "totalCents") SELECT "buyerEmail", "buyerName", "buyerPhone", "createdAt", "eventId", "id", "notes", "payMethod", "refCode", "sellerId", "status", "totalCents" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_refCode_key" ON "Order"("refCode");
CREATE UNIQUE INDEX "Order_inviteCode_key" ON "Order"("inviteCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
