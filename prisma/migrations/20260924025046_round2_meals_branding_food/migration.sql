-- AlterTable
ALTER TABLE "MealOption" ADD COLUMN "tag" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "foodCollectedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATETIME NOT NULL,
    "venue" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "etransferEmail" TEXT,
    "zelleHandle" TEXT,
    "cashNote" TEXT,
    "logoUrl" TEXT,
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("cashNote", "createdAt", "createdById", "currency", "date", "description", "etransferEmail", "id", "slug", "status", "title", "venue", "zelleHandle") SELECT "cashNote", "createdAt", "createdById", "currency", "date", "description", "etransferEmail", "id", "slug", "status", "title", "venue", "zelleHandle" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
