-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SponsorAd" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'SILVER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SponsorAd_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SponsorAd" ("createdAt", "eventId", "id", "imageUrl", "linkUrl", "name", "sortOrder") SELECT "createdAt", "eventId", "id", "imageUrl", "linkUrl", "name", "sortOrder" FROM "SponsorAd";
DROP TABLE "SponsorAd";
ALTER TABLE "new_SponsorAd" RENAME TO "SponsorAd";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
